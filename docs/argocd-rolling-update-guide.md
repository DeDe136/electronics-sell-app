# Hướng dẫn: Cài Argo CD & demo Rolling Update trên K3s

File này ghi lại toàn bộ bước chuyển sang GitOps bằng Argo CD — từ cài đặt,
đăng nhập UI, kết nối repo private, tới demo rolling update bằng dữ liệu
thật (build/push image mới qua CI/CD).

Đi kèm 2 file cấu hình để bạn chọn cách tạo Application: **qua UI** (từng
bước bên dưới) hoặc **qua `kubectl apply`** (dùng `argocd-application.yaml` +
`argocd-repo-secret.yaml`, mục 9).

## 0. Vị trí đặt file trong project

```
electronics-sell-app-thanhde/
├── argo/
│   ├── argocd-application.example.yaml    # mẫu
│   ├── argocd-repo-secret.example.yaml    # mẫu
│   ├── argocd-server-values.yaml          # values cho chính chart argo-cd (Ingress...)
│   ├── argocd-application.yaml            # bản copy điền giá trị thật, GITIGNORE
│   └── argocd-repo-secret.yaml            # bản copy điền giá trị thật, GITIGNORE
├── docs/
│   ├── k3s-n-helm-local-deployment-guide.md
│   └── argocd-rolling-update-guide.md
├── helm/
│   └── electronics-shop/
...
```

Đúng theo cấu trúc đã dùng cho `values-dev-example.yaml` → `values-dev.yaml`
trong `helm/electronics-shop/` — file `.example.yaml` là mẫu tham khảo commit
được, bản copy không có `.example` mới chứa credential thật.

---

## 1. Cài Argo CD

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
helm install argocd argo/argo-cd -n argocd --create-namespace
```

Đợi Pod khởi động xong:
```bash
kubectl get pods -n argocd -w
```

## 2. Truy cập UI

Lấy mật khẩu admin:
```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d; echo
```

Chọn 1 trong 2 cách để vào UI — có thể dùng cả 2 song song, không xung đột:

### Cách A — Port-forward (nhanh, không cần đổi gì trong cluster)

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Mở `https://localhost:8080`, bỏ qua cảnh báo cert tự ký.

### Cách B — Ingress (không cần giữ terminal chạy port-forward mỗi lần)

Cần chuyển Argo CD server sang HTTP trước (Ingress HTTP thường không tự xử
lý được gRPC/TLS mà Argo CD server mặc định yêu cầu):

```bash
helm upgrade argocd argo/argo-cd -n argocd -f argo/argocd-server-values.yaml
```

File `argocd-server-values.yaml` (đi kèm) đã bật sẵn `server.insecure: true`
+ `server.ingress.enabled: true`, host mặc định `argocd.techshop.local` —
sửa lại host nếu muốn dùng domain khác.

Trỏ domain (lấy IP Traefik đang expose, giống cách đã làm với
`techshop.local` trong `k3s-n-helm-local-deployment-guide.md`):
```bash
kubectl get svc -n kube-system traefik   # xem cột EXTERNAL-IP
```
Thêm vào `hosts` (cả WSL2 lẫn Windows):
```
<EXTERNAL-IP-traefik>  argocd.techshop.local
```

Từ giờ vào thẳng `http://argocd.techshop.local`, không cần giữ terminal
`port-forward` nữa.

Đăng nhập cả 2 cách đều dùng `admin` + mật khẩu lấy ở trên.

## 3. Kết nối repo GitHub private

> ⚠️ **Chỉ cần làm mục 3 này nếu repo Git là PRIVATE.** Nếu repo public,
> Argo CD đọc được thẳng không cần đăng ký credential gì cả — bỏ qua toàn bộ
> mục 3, sang thẳng mục 4.

**3.1. Tạo GitHub Personal Access Token (PAT):**
GitHub → **Settings** → **Developer settings** → **Personal access tokens** →
**Fine-grained tokens** → **Generate new token** → chọn đúng repo → quyền
**Contents: Read-only** → Generate, copy token lại ngay.

**3.2. Đăng ký repo với Argo CD** — chọn 1 trong 2 cách:

- **Qua UI:** Argo CD → **Settings** → **Repositories** → **Connect Repo** →
  điền URL repo, username GitHub, PAT làm password → **Connect**.
- **Qua `kubectl apply`:** copy file mẫu ra bản thật rồi điền credential:
  ```bash
  cp argo/argocd-repo-secret.example.yaml argo/argocd-repo-secret.yaml
  ```
  Sửa `argocd-repo-secret.yaml` (bản copy) — điền username/PAT — rồi:
  ```bash
  kubectl apply -f argo/argocd-repo-secret.yaml -n argocd
  ```

## 4. Dọn release Helm cũ (tránh lỗi ownership)

Vì trước đó đã `helm install` tay, cần gỡ để Argo CD quản lý lại từ đầu:
```bash
helm uninstall electronics-shop -n electronics-shop
```

## 5. Tạo Application

Chọn 1 trong 2 cách:

### Cách A — Qua UI

**+ New App**, điền:

| Trường | Giá trị |
|---|---|
| Application Name | `electronics-shop` |
| Project | `default` |
| Sync Policy | `Manual` (chuyển `Automated` sau khi xác nhận ổn) |
| Repository URL | `https://github.com/<username>/<repo-name>.git` |
| Revision | `main` |
| Path | `helm/electronics-shop` |
| Cluster URL | `https://kubernetes.default.svc` |
| Namespace | `electronics-shop` |

Mục **HELM > VALUES**: dán nội dung `values-dev.yaml` (registry IP +
`harborAuth`) vào ô values — vì file này không nằm trên Git, đây là cách
"truyền" nó cho Argo CD.

Bấm **Create**.

**Thêm `ignoreDifferences` cho backend/frontend (bắt buộc nếu dùng HPA — xem
mục 11)** — form **+ New App** không có ô riêng cho phần này, cần thêm sau
khi tạo:
- Vào Application `electronics-shop` → mục **DETAILS** ở góc trên bên trái → chuyển
  sang tab **MANIFEST** (chế độ xem dạng YAML thô của chính Application)
  và chọn Edit → tìm/tạo field `ignoreDifferences`, thêm đúng nội dung:
  ```yaml
  ignoreDifferences:
    - group: apps
      kind: Deployment
      name: backend
      jsonPointers:
        - /spec/replicas
    - group: apps
      kind: Deployment
      name: frontend
      jsonPointers:
        - /spec/replicas
  ```
- Bấm **Save**.

(Nếu tạo Application qua Cách B — `kubectl apply` — phần này đã có sẵn trong
`argocd-application.example.yaml`, không cần thêm tay.)

### Cách B — Qua `kubectl apply`

Copy file mẫu ra bản thật:
```bash
cp argo/argocd-application.example.yaml argo/argocd-application.yaml
```

Sửa các giá trị `<...>` trong `argocd-application.yaml` (bản copy — registry,
username, token robot account — tương đương nội dung `values-dev.yaml`), rồi:

```bash
kubectl apply -f argo/argocd-application.yaml -n argocd
```

> ⚠️ File `argocd-application.yaml` (bản copy, sau khi điền) chứa credential
> thật — **không commit lên Git**, coi như bản YAML của `values-dev.yaml`.
> Chỉ file `argocd-application.example.yaml` (giữ nguyên placeholder) mới nên
> commit.

## 6. Sync lần đầu

Trạng thái ban đầu `Missing` + `OutOfSync` là bình thường (chưa tồn tại trên
cluster). Trong UI, bấm **Sync** → **Synchronize**. Theo dõi:
```bash
kubectl get pods -n electronics-shop -w
```

Kỳ vọng: `Healthy` + `Synced`.

## 7. Bật Auto-Sync

Application → **Sync Policy** → bật:
- **Automated** — tự Sync khi Git có commit mới (poll mỗi ~3 phút, hoặc tức
  thời nếu có webhook — mục 8).
- **Self Heal** — tự sửa lại nếu cluster bị chỉnh tay lệch khỏi Git.
- **Prune** — tự xoá resource nếu bị xoá khỏi chart trong Git.

(Nếu tạo Application qua `kubectl apply`, bỏ comment khối `automated:` trong
`argocd-application.yaml` — **bản copy thật**, không phải file `.example.yaml`
— rồi `kubectl apply` lại.)

## 8. Webhook — Sync tức thời thay vì đợi poll
 
Cách mở tunnel **khác nhau tuỳ bạn đang dùng Cách A hay Cách B ở mục 2** —
đọc và thực hiện đúng trường hợp của bạn, đừng làm cả 2.
 
### 8.1a. Nếu đang dùng Cách A (port-forward)
 
Argo CD mặc định tự phục vụ HTTPS bằng 1 chứng chỉ **tự ký** (self-signed).
`ngrok` (bước 8.2) hoạt động như 1 "mặt tiền" — nó tự có chứng chỉ TLS hợp
lệ riêng ở phía Internet, rồi chuyển tiếp traffic vào cổng cục bộ của bạn.
Nếu để `ngrok` trỏ vào cổng **HTTPS** nội bộ (chứng chỉ tự ký), nó phải
được cấu hình thêm để "bỏ qua xác thực" TLS ở chặng nội bộ đó — rắc rối
không cần thiết cho môi trường demo/test. Trỏ `ngrok` thẳng vào cổng
**HTTP** đơn giản hơn hẳn: `ngrok` tự lo phần HTTPS ở "mặt tiền" hướng ra
GitHub, chặng nội bộ (từ `ngrok` vào ArgoCD trong máy bạn) chỉ cần HTTP thuần, không
chứng chỉ nào phải xử lý cả. Đây là giải pháp phù hợp cho demo local —
trên EKS, Argo CD có chứng chỉ TLS hợp lệ thật (qua ALB/ACM), không cần
đổi sang HTTP như cách này.

 
```bash
helm upgrade argocd argo/argo-cd -n argocd --reuse-values \
  --set configs.params."server\.insecure"=true
 
# Crtl + C để dừng port-forward HTTPS (8080:443) cũ nếu đang chạy, thay bằng HTTP:
kubectl port-forward svc/argocd-server -n argocd 8080:80
```
 
Từ giờ vào UI bằng `http://localhost:8080` (không còn `https://`), và
`ngrok` ở mục 8.2 sẽ trỏ vào `8080`.
 
### 8.1b. Nếu đang dùng Cách B (Ingress) — KHÔNG cần `port-forward`
 
Đây là điểm dễ nhầm: `argocd-server-values.yaml` đã bật sẵn
`server.insecure: true`, và Traefik (Ingress) đã ánh xạ port 80 trong kernel xuyên qua
iptables/IPVS ngay trong network namespace của WSL2 — đúng cơ chế đã kiểm
chứng lúc debug `techshop.local` trước đây (`curl 127.0.0.1:80` từ **trong**
WSL2 luôn chạm được tới Traefik, dù không có tiến trình nào "bind" cổng đó
theo cách `ss` nhìn thấy được). Nói cách khác: **port 80 đã được "ánh xạ sẵn"** ngay
trong WSL2 thông qua Traefik, thêm 1 lớp `port-forward` nữa là dư thừa, dẫn đến ta
không cần chạy gì thêm ở bước này — sang thẳng mục 8.2, `ngrok` sẽ trỏ thẳng
vào port 80 có sẵn.
 
### 8.2. Cài đặt `ngrok` + đăng ký tài khoản lấy authtoken
 
Đăng ký tài khoản (miễn phí đủ dùng cho demo): vào `https://dashboard.ngrok.com/signup`,
tạo tài khoản bằng email hoặc đăng nhập qua GitHub/Google — xác nhận email
nếu được yêu cầu.
 
Sau khi đăng nhập, vào `https://dashboard.ngrok.com/get-started/your-authtoken`
— trang này hiện sẵn đúng authtoken của bạn, copy lại.
 
Cài `ngrok` trong WSL2:
```bash
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok
```
 
Đăng ký authtoken vừa copy vào `ngrok` CLI (chỉ cần làm 1 lần, lưu lại trong
`~/.config/ngrok/ngrok.yml`):
```bash
ngrok config add-authtoken <token-vừa-copy-từ-dashboard>
```
 
### 8.3. Tạo tunnel & khai báo webhook
 
**Nếu dùng Cách A (port-forward):**
```bash
ngrok http 8080
```
 
**Nếu dùng Cách B (Ingress):** trỏ thẳng vào port 80 sẵn có, kèm cờ
`--host-header` — vì không đi qua `port-forward` 1-1 vào thẳng Service nữa,
`ngrok` cần tự thêm đúng header `Host: argocd.techshop.local` vào mỗi request
để Traefik biết định tuyến tới đúng Ingress (Traefik định tuyến theo tên
miền, không phải theo cổng):
```bash
ngrok http --host-header=argocd.techshop.local 80
```
 
Cả 2 trường hợp, terminal hiện dòng `Forwarding` dạng
`https://abcd-1234.ngrok-free.app -> http://localhost:<port>` — giữ nguyên
terminal này chạy, tắt đi là tunnel mất.
 
Khai báo trên GitHub repo → **Settings** → **Webhooks** → **Add webhook**:
- Payload URL: `https://abcd-1234.ngrok-free.app/api/webhook`
- Content type: `application/json`
- Events: **Just the push event**

> ⚠️ URL `ngrok` free đổi mỗi lần khởi động lại — chỉ phù hợp demo/test local.
> Trên EKS, Argo CD có địa chỉ public thật, không cần tunnel.

## 9. Demo Rolling Update

Rolling update xảy ra khi **Pod template đổi** (image, env, annotation...),
không phải khi chỉ tăng `replicaCount` (đó là scale, không phải update). Demo
theo 2 bước tách biệt:

### 9.1. Test HPA tự scale up/down (thay cho việc tăng `replicaCount` tay)

> Vì đã bật HPA (mục 10), **không cần tự tăng `replicaCount`** trong
> `values.yaml` nữa để có nhiều Pod — HPA tự quyết định số Pod dựa theo tải
> thật. Xem chi tiết cách test ở mục 10.2. Sau khi HPA đã tự scale lên ≥2
> Pod, tiếp tục mục 9.2 bên dưới để demo đúng rolling update trên nhiều Pod
> đó.

### 9.2. Trigger rolling update bằng code + image thật

Sửa code thật (ví dụ `backend/src/health.controller.ts`, chỉnh field
`version`), rồi build/push theo đúng luồng CI/CD đã thiết lập:

```bash
git add backend/src/health.controller.ts
git commit -m "demo: add version field to health check"
git push
```

CI (`ci.yml`) → CD (`deploy.yml`) tự build/scan/push image tag theo commit
SHA, tự cập nhật `backendTag` trong `values.yaml`, tự commit `[skip ci]` —
Argo CD nhận thấy Git đổi, tự Sync, đổi image trong Deployment → **hash Pod
template đổi thật sự** → rolling update thật diễn ra (có pull image mới, vì
tag khác, không phải tag `latest` bị cache).

### 9.3. Quan sát

```bash
kubectl rollout status deployment/backend -n electronics-shop
kubectl get pods -n electronics-shop -l app=backend -w
```

Kỳ vọng thấy tiến trình dạng (với số lượng replica thực tế tuỳ thuộc vào HPA đang giữ ở
mức nào tại thời điểm đó, không cố định số replica như deployment):
```
Waiting for deployment "backend" rollout to finish: 1 out of 3 new replicas have been updated...
Waiting for deployment "backend" rollout to finish: 2 out of 3 new replicas have been updated...
deployment "backend" successfully rolled out
```

Xác nhận trực quan bằng cách gọi liên tục trong lúc rolling update đang chạy
— sẽ thấy response xen kẽ giữa bản cũ/mới (2 phiên bản cùng phục vụ traffic,
không downtime):
```bash
for i in {1..10}; do curl -s http://techshop.local/api/v1/health; echo; sleep 1; done
```

---

## 10. HPA — tự động scale theo CPU/Memory

Khác với mục 9 (rolling update — thay Pod bằng bản mới), HPA
(HorizontalPodAutoscaler) giải quyết bài toán khác: **tự tăng/giảm SỐ LƯỢNG
Pod** theo tải thực tế, không cần bạn tự sửa `replicaCount` trong Git mỗi lần
traffic đổi.

### 10.1. Cấu hình

Đã có sẵn trong `helm/electronics-shop/templates/hpa.yaml` +
`values.yaml` (khối `autoscaling`), scale theo **cả CPU lẫn Memory** — HPA
lấy điều kiện nghiêm ngặt hơn trong 2 metric, chỉ cần 1 trong 2 vượt ngưỡng
(mặc định CPU 70%, Memory 80% so với `resources.requests` đã khai) là đã
scale up.

**⚠️ Cần `metrics-server`** để HPA đọc được % CPU/Memory — K3s có sẵn mặc
định, kiểm tra:
```bash
kubectl get deployment metrics-server -n kube-system
```

**⚠️ Xung đột với Argo CD Self Heal:** nếu để `spec.replicas` cố định trong
`Deployment`, Self Heal sẽ liên tục kéo số Pod về đúng Git, đánh nhau với
HPA. Đã xử lý 2 lớp:
1. `templates/backend.yaml`/`frontend.yaml` **bỏ hẳn field `replicas`** khi
   `autoscaling.<service>.enabled=true` — không có gì để Self Heal "áp đặt
   lại".
2. `ignoreDifferences` trong `argocd-application.example.yaml` (mục 5) — lớp
   phòng vệ thứ 2, phòng khi lỡ vẫn còn field `replicas` ở đâu đó.

Argo CD tự Sync khi đã push lên GitHub → kiểm tra:
```bash
kubectl get hpa -n electronics-shop
```

### 10.2. Test scale up

Tạo tải giả liên tục gọi vào backend:
```bash
kubectl run load-test --rm -it --restart=Never -n electronics-shop --image=busybox -- \
  /bin/sh -c "while true; do wget -q -O- http://backend:3001/api/v1/health; done"
```

Terminal khác, theo dõi:
```bash
kubectl get hpa -n electronics-shop -w
```

Kỳ vọng: cột `TARGETS` (dạng `85%/70%, 45%/80%` — CPU/Memory hiện tại so với
ngưỡng) tăng vượt ngưỡng, `REPLICAS` tự tăng dần (do `scaleUp.stabilizationWindowSeconds: 0`,
phản ứng gần như ngay lập tức).

### 10.3. Test scale down

Dừng lệnh `load-test` (Ctrl+C, Pod tự xoá nhờ `--rm`). Traffic về 0 →
`TARGETS` giảm dần. Do `scaleDown.stabilizationWindowSeconds: 60`, HPA **cố
tình đợi tối thiểu 60 giây** traffic thấp liên tục mới thật sự giảm Pod
(tránh "flapping" — scale xuống rồi lại phải scale lên ngay vì traffic dao
động ngắn hạn). Tiếp tục theo dõi `kubectl get hpa -n electronics-shop -w`,
sau ~1 phút sẽ thấy `REPLICAS` giảm dần về lại `minReplicas`.

---

## 11. Các lỗi đã gặp khi làm phần Argo CD (tham khảo)

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| Application báo `Missing`/`OutOfSync` ngay sau khi tạo | Bình thường — cluster chưa có gì so với Git | Bấm Sync |
| Lỗi ownership khi Sync lần đầu | Namespace/resource đã tồn tại từ lần `helm install` tay trước đó | `helm uninstall` trước khi để Argo CD tạo lại từ đầu |
| Webhook `Payload URL` không gọi được | Argo CD chỉ chạy `port-forward` cục bộ, không có địa chỉ public | Dùng `ngrok` tạo tunnel tạm |
| Chỉ tăng `replicaCount` mà tưởng là "rolling update" | Tăng replica chỉ là scale — không đổi Pod template, không kích hoạt rolling update | Cần đổi thứ gì đó trong Pod template (image, env...) mới kích hoạt |
| Pod mới không thật sự pull image mới dù đã "update" | Dùng annotation giả để trigger rolling update, tag ảnh không đổi, `pullPolicy: IfNotPresent` dùng cache | Dùng tag thật theo commit SHA (đã tự động qua CI/CD) để vừa trigger rolling update vừa pull đúng code mới |
| HPA tự scale lên rồi bị Argo CD kéo ngược lại ngay sau đó | Self Heal thấy `spec.replicas` "lệch" so với Git (Git khai cố định), tự sửa lại | Bỏ field `replicas` khỏi Deployment khi HPA quản lý + thêm `ignoreDifferences` (mục 10.1) |
| `kubectl get hpa` báo `<unknown>` ở cột `TARGETS` | `metrics-server` chưa chạy hoặc chưa kịp thu thập dữ liệu (mới khởi động) | Kiểm tra `kubectl get deployment metrics-server -n kube-system`, đợi thêm 1-2 phút |