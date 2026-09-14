# Hướng dẫn: Dựng K3s local & deploy TechShop bằng Helm

Tài liệu này ghi lại đầy đủ các bước đã thực hiện thành công trên môi trường:
**Windows + WSL2 (Ubuntu) + K3s**, image kéo từ **Harbor riêng** (IP + self-signed
cert). Đã bao gồm các lỗi thực tế gặp phải và cách đã sửa — để tránh lặp lại
khi làm trên máy khác, hoặc khi porting sang EKS sau này.

---

## 0. Kiến trúc tổng quan

```
Windows (trình duyệt)
   │  http://techshop.local, http://minio.techshop.local
   ▼
WSL2 (Ubuntu) — chạy K3s
   ├─ Traefik (Ingress, có sẵn trong K3s)
   ├─ backend (NestJS)  ──┐
   ├─ frontend (Next.js) ─┤── gọi nội bộ qua Kubernetes Service DNS
   ├─ postgres (StatefulSet + PVC local-path)
   └─ minio (StatefulSet + PVC local-path)
        ▲
        │ pull image
   Harbor (server riêng, IP + self-signed CA)
```

---

## 1. Cài K3s

```bash
curl -sfL https://get.k3s.io | sh -
sudo k3s kubectl get nodes    # kiểm tra STATUS = Ready
```

Lấy kubeconfig để dùng `kubectl` không cần `sudo k3s`:

```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
export KUBECONFIG=~/.kube/config
echo 'export KUBECONFIG=~/.kube/config' >> ~/.bashrc   # để mở terminal mới vẫn nhớ

kubectl get nodes
```

## 2. Cài Helm

```bash
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version
```

## 3. Cho K3s tin CA self-signed của Harbor

> Áp dụng vì Harbor dùng IP + self-signed cert. Nếu Harbor dùng domain +
> Let's Encrypt, bỏ qua bước này, chỉ cần khai `auth` (không cần `ca_file`).

**3.1. Copy CA cert từ server Harbor về máy WSL2:**
```bash
ssh-add <key-pair-name>.pem
scp <user>@<IP-harbor>:/etc/harbor/ssl/ca.crt ~/harbor-ca.crt
sudo mkdir -p /etc/rancher/k3s
sudo cp ~/harbor-ca.crt /etc/rancher/k3s/harbor-ca.crt
```

**3.2. Khai báo registry cho containerd**

Tạo thẳng file bằng lệnh `tee` dưới đây — không cần tạo file trước rồi mở
trình soạn thảo để sửa. Chỉ cần **thay 3 placeholder** (`<IP-server-harbor>`
xuất hiện 3 lần, `<robot-account-username>`, `<robot-account-token>`) bằng
giá trị thật của bạn trước khi dán vào terminal, rồi chạy nguyên khối:

```bash
sudo tee /etc/rancher/k3s/registries.yaml <<'EOF'
mirrors:
  "<IP-server-harbor>":
    endpoint:
      - "https://<IP-server-harbor>"

configs:
  "<IP-server-harbor>":
    tls:
      ca_file: /etc/rancher/k3s/harbor-ca.crt
    auth:
      username: "<robot-account-username>"
      password: "<robot-account-token>"
EOF
```

Kiểm tra lại nội dung đã thay đúng placeholder chưa:
```bash
sudo cat /etc/rancher/k3s/registries.yaml
```

```bash
sudo systemctl restart k3s
kubectl get nodes    # xác nhận vẫn Ready sau khi restart
```

> Lưu ý: đây là cấu hình cho **containerd** (K3s tự pull image). Riêng
> Kubernetes (kubelet) cần thêm 1 cơ chế xác thực khác — xem mục 5, giờ đã
> được Helm chart tự động hoá, không cần `kubectl create secret` tay nữa.

## 4. Đặt Helm chart vào repo

Chart nằm chung repo, ngang hàng `backend/`, `frontend/`, `docker/`:

```
electronics-sell-app/
├── backend/
├── frontend/
├── docker/
├── helm/
│   └── electronics-shop/
│       ├── Chart.yaml
│       ├── values.yaml                 # mặc định, COMMIT lên Git
│       ├── values-dev-example.yaml     # mẫu tham khảo, COMMIT lên Git
│       ├── values-eks-example.yaml     # mẫu cho EKS sau này, COMMIT lên Git
│       ├── values-dev.yaml             # giá trị thật riêng máy bạn, GITIGNORE
│       ├── .helmignore
│       └── templates/
│           ├── _helpers.tpl
│           ├── backend.yaml
│           ├── frontend.yaml
│           ├── postgres.yaml
│           ├── minio.yaml
│           ├── harbor-pull-secret.yaml
│           ├── ingress.yaml
│           └── config-and-secrets.yaml
```

**`.gitignore`** (thêm dòng):
```
helm/electronics-shop/values-dev.yaml
```

**`values-dev.yaml`** (copy từ `values-dev-example.yaml`, điền giá trị thật):
```yaml
image:
  registry: "<IP-server-Harbor>"
  harborAuth:
    username: "robot$electronics-shop+ci-cd"
    password: "<robot-token-that>"
```

## 5. Build lại frontend image cho đúng domain test

> **Chỉ cần làm mục này nếu** lần build/push frontend image gần nhất đang
> dùng giá trị mặc định `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`
> (tức chưa từng truyền `--build-arg` khi build, hoặc build từ trước khi
> biết vấn đề này). **Nếu image đã được build/push với đúng
> `NEXT_PUBLIC_API_URL=http://techshop.local/api/v1` từ đầu, bỏ qua toàn bộ
> mục này, sang thẳng mục 6.**

`NEXT_PUBLIC_API_URL` trong `docker/frontend.Dockerfile` bị **đóng cứng
vào bundle JS lúc build** (khác các biến `ENV` thường, đọc được lúc chạy)
— nên phải build lại, không sửa được bằng cách đổi biến môi trường của Pod:

```bash
cd ~/electronics-sell-app

docker build \
  -f docker/frontend.Dockerfile \
  -t <IP-server-Harbor>/electronics-shop/frontend:latest \
  --build-arg NEXT_PUBLIC_API_URL=http://techshop.local/api/v1 \
  .

docker login <IP-server-Harbor> -u <username> -p <robot-account-token>   # nếu chưa login
docker push <IP-server-Harbor>/electronics-shop/frontend:latest
```

Vì giữ nguyên tag `latest`, K3s sẽ **không** tự nhận ra image đã đổi
(`pullPolicy: IfNotPresent` — thấy tag `latest` đã có sẵn trên node là bỏ
qua, không pull lại). Cần xoá bản cache cũ trên node để ép pull lại bản
mới vừa push:

```bash
# Liệt kê các image đang có trong K3s, tìm đúng image ID/tên của frontend
sudo k3s crictl images

# Xoá image frontend cũ (thay <IMAGE-ID_hoặc_TÊN> bằng giá trị lấy được ở trên,
# ví dụ: sudo k3s crictl rmi <IP-server-Harbor>/electronics-shop/frontend:latest)
sudo k3s crictl rmi <IMAGE-ID_hoặc_TÊN>
```

Sau đó deploy lại (mục 6) như bình thường — vì image đã bị xoá khỏi cache,
K3s buộc phải pull lại bản mới nhất từ Harbor.

> Ghi chú kiến trúc: `INTERNAL_API_URL` (khác `NEXT_PUBLIC_API_URL`) đọc
> lúc **runtime** bằng `process.env`, chỉ dùng được trong code chạy phía
> server (Server Component, Route Handler) — không cần build lại image khi
> đổi giá trị này, chỉ cần sửa `env:` trong Deployment. Đây là biến K8s
> tiêm vào lúc Pod khởi động (`templates/frontend.yaml`), không tồn tại
> trong Dockerfile.

## 6. Deploy app

```bash
helm upgrade --install electronics-shop helm/electronics-shop \
  --namespace electronics-shop --create-namespace \
  -f helm/electronics-shop/values-dev.yaml
```

Kiểm tra:
```bash
kubectl get pods -n electronics-shop
# backend, frontend, postgres-0, minio-0 đều Running (1/1)
kubectl get ingress -n electronics-shop
# 2 dòng: electronics-shop, electronics-shop-minio, đều có ADDRESS
```

### Vì sao lệnh chỉ có `--namespace`, không có gì khác đặc biệt

- `--create-namespace`: bắt buộc phải có (chart **không** tự khai
  `Namespace` trong templates — cố tình bỏ, vì nếu giữ, nó xung đột trực
  tiếp với chính cờ này khi cả 2 cùng cố "sở hữu" namespace, gây lỗi
  `already exists` mỗi lần cài lại).

## 7. Trỏ domain — riêng cho WSL2

Traefik chạy **trong** WSL2, nhưng cơ chế "gõ `localhost` từ Windows vào
được WSL2" (localhost-forwarding) **không hoạt động** với kiểu networking
ảo hoá nhiều tầng của Kubernetes Service (khác với 1 tiến trình `docker run
-p` bind cổng trực tiếp) — nên **không dùng `127.0.0.1`** trong hosts của
Windows.

**Lấy đúng IP mà Traefik thật sự expose:**
```bash
kubectl get svc -n kube-system traefik
# xem cột EXTERNAL-IP, ví dụ: 172.31.100.36
```

**Trên Windows, sửa `C:\Windows\System32\drivers\etc\hosts`** (Notepad quyền Administrator):
```
172.31.100.36  techshop.local minio.techshop.local s3.techshop.local
```

```powershell
ipconfig /flushdns
```

> ⚠️ IP này **có thể đổi mỗi khi khởi động lại Windows/WSL2** — cần kiểm
> tra lại `kubectl get svc -n kube-system traefik` và sửa `hosts` nếu IP
> thay đổi. Muốn hết phải làm lại mỗi lần, cân nhắc bật **mirrored
> networking mode** của WSL2.

**Trong WSL2** (để `curl` test được ngay trong terminal Ubuntu, dùng
`127.0.0.1` vẫn được vì traffic phát sinh từ chính trong WSL2):
```bash
echo "127.0.0.1  techshop.local minio.techshop.local s3.techshop.local" | sudo tee -a /etc/hosts
```

## 8. Test app

```bash
curl -i http://techshop.local/api/v1/health      # backend
```
Trình duyệt Windows: `http://techshop.local` (frontend), `http://minio.techshop.local` (MinIO console, login `minioadmin`/`minioadmin` hoặc giá trị đã đổi trong `values-dev.yaml`).

## 9. Seed dữ liệu mẫu

Script seed (`backend/src/database/seeds/run-seeds.ts`) luôn kết nối qua
`localhost:5432` — không chạy trong container, mà chạy **từ máy dev**, nên
cần mở đường hầm vào Postgres trước:

```bash
kubectl port-forward svc/postgres -n electronics-shop 5432:5432
```

> Lệnh này chiếm giữ terminal (foreground) — mở port cho **toàn máy dev**,
> không riêng gì terminal đó, nhưng chỉ tồn tại khi tiến trình còn chạy.
> Có thể thêm `&` ở cuối để chạy nền.

Terminal khác, cấu hình `backend/.env` (chỉ cần đúng `DB_PORT`,
`DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` khớp với `values-dev.yaml` hoặc giá trị mặc định trong `values.yaml`; **không
cần sửa `SEED_DB_HOST`** — script mặc định luôn dùng `localhost`; gán biến `SEED_MEDIA_BASE` trong backend/.env thành **http://minio:9000/electronics-shop**), rồi chạy:

```bash
cd ~/electronics-sell-app
bash scripts/seed.sh
```

> Không dùng Ingress cho Postgres: Ingress chỉ hiểu HTTP/HTTPS (Layer 7),
> Postgres dùng giao thức TCP riêng — về kỹ thuật không route qua Ingress
> được. `port-forward` là cách chuẩn cho truy cập tạm thời từ máy dev.

---

## 10. Các lỗi đã gặp và cách đã sửa (tham khảo khi gặp lại)

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| `Namespace ... invalid ownership metadata` | Namespace đã được tạo tay (`kubectl create namespace`) trước khi Helm quản lý | Gắn nhãn/annotation `app.kubernetes.io/managed-by=Helm` + `meta.helm.sh/release-name`/`release-namespace` (giải pháp tạm) — **về sau đã bỏ hẳn `templates/namespace.yaml`**, chỉ dùng `--create-namespace` |
| `job minio-init failed: BackoffLimitExceeded` | Job chạy `mc alias set` ngay khi Pod start, MinIO chưa kịp sẵn sàng, hết `backoffLimit` (đếm theo số lần restart trong 1 Pod, không phải nhiều Pod) | Sửa script Job thành vòng lặp `until mc alias set ...; do sleep 3; done` — tự retry tới khi MinIO sẵn sàng |
| `job minio-init failed: DeadlineExceeded` | `activeDeadlineSeconds: 180` quá chặt cho lần cài đầu (phải pull image MinIO + mc + cấp phát PVC) | Tăng lên `600` (10 phút) |
| `Cannot use two forms of the same flag: p ignore-existing` | Dùng chung `-p` và `--ignore-existing` trong `mc mb` — không hợp lệ với bản `mc` đang dùng | Bỏ `-p` (không cần vì tên bucket không có `/`), chỉ giữ `--ignore-existing` |
| `namespaces "..." not found` rồi `already exists` khi đổi cờ `--create-namespace` | `templates/namespace.yaml` trong chart và cờ `--create-namespace` cùng cố quản lý 1 Namespace theo 2 cách không nhận ra nhau | Xoá hẳn `templates/namespace.yaml`, chỉ dùng `--create-namespace` |
| Trình duyệt Windows: `ERR_CONNECTION_REFUSED` dù `curl` trong WSL2 chạy được | `hosts` Windows trỏ `127.0.0.1` — cơ chế localhost-forwarding của WSL2 không nhận diện được cổng do Kubernetes Service quản lý (không phải kiểu bind cổng trực tiếp) | Trỏ `hosts` sang IP thật của WSL2/Traefik (`kubectl get svc -n kube-system traefik`, cột `EXTERNAL-IP`) |
| Trang chi tiết sản phẩm không load được ảnh/dữ liệu, dù trang chủ vẫn ổn | `NEXT_PUBLIC_API_URL` bị đóng cứng lúc build thành `http://localhost:3001/api/v1` — trình duyệt user cố gọi `localhost` của chính máy họ | Build lại frontend image với `--build-arg NEXT_PUBLIC_API_URL=http://techshop.local/api/v1`, xoá cache image cũ bằng `sudo k3s crictl rmi`, `helm upgrade` |

---

## 11. Checklist khi porting sang EKS (tham khảo, chưa thực hiện)

- [ ] Copy `values-eks-example.yaml` → `values-eks.yaml`, điền domain/registry thật
- [ ] Đổi `storageClassName` → `gp3` (EBS CSI driver)
- [ ] Đổi `ingress.className` → `alb` (AWS Load Balancer Controller)
- [ ] `harborAuth`/`imagePullSecret` vẫn hoạt động y hệt — không cần chỉnh
      containerd thủ công như mục 3 (K3s), managed Kubernetes chỉ cần
      `imagePullSecrets` ở tầng Pod là đủ
- [ ] Cân nhắc thay Kubernetes Secret thô (`config-and-secrets.yaml`) bằng
      Vault Agent Injector hoặc External Secrets Operator + AWS Secrets Manager
- [ ] Build lại frontend image với `NEXT_PUBLIC_API_URL` trỏ đúng domain EKS thật
- [ ] Argo CD trỏ Application sang cluster EKS, tự động sync từ `helm/electronics-shop`