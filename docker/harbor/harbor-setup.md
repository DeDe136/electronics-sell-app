# Hướng dẫn dựng Harbor Registry cho electronics-sell-app

Tài liệu này hướng dẫn dựng một server [Harbor](https://goharbor.io/) làm private container registry để lưu trữ image `backend` và `frontend` build ra từ `docker/backend.Dockerfile` và `docker/frontend.Dockerfile`, tích hợp với pipeline CI/CD (`.github/workflows/deploy.yml`).

## Mục lục

1. [Yêu cầu hạ tầng](#1-yêu-cầu-hạ-tầng)
2. [Cài Docker Engine + Docker Compose trên server Harbor](#2-cài-docker-engine--docker-compose-trên-server-harbor)
3. [Tải và cấu hình Harbor](#3-tải-và-cấu-hình-harbor)
4. [Cài đặt Harbor](#4-cài-đặt-harbor)
5. [Tạo Project và Robot Account](#5-tạo-project-và-robot-account)
6. [Cấu hình máy client để push/pull image](#6-cấu-hình-máy-client-để-pushpull-image)
7. [Test push/pull](#7-test-pushpull)
8. [Tích hợp vào GitHub Actions](#8-tích-hợp-vào-github-actions)
9. [Gỡ bỏ / dọn dẹp certificate](#9-gỡ-bỏ--dọn-dẹp-certificate)
10. [Bảo trì](#10-bảo-trì)

---

## 1. Yêu cầu hạ tầng

Một server Linux **riêng biệt** với server đang chạy app (không bắt buộc, nhưng khuyến khích để tách trách nhiệm):

- Ubuntu 22.04/24.04, ≥ 2 vCPU, ≥ 4GB RAM, ≥ 40GB disk
- Trước khi bắt đầu, xác định bạn thuộc trường hợp nào — mỗi trường hợp có cách cấu hình khác nhau ở các bước sau:

| | Có domain trỏ về server | Chỉ có IP (chưa có domain) |
|---|---|---|
| **Chứng chỉ TLS** | Let's Encrypt (miễn phí, được trust sẵn) | Self-signed certificate (tự tạo bằng openssl) |
| **Độ phức tạp** | Thấp | Trung bình — cần trust CA thủ công trên từng máy client |
| **Phù hợp** | Production, VPS công khai | Test nội bộ, LAN, server chưa gắn domain |

> Toàn bộ hướng dẫn dưới đây trình bày song song 2 nhánh **[DOMAIN]** và **[IP]**. Đọc đúng nhánh phù hợp với bạn, bỏ qua nhánh còn lại.

---

## 2. Cài Docker Engine + Docker Compose trên server Harbor

Trên server Linux sẽ chạy Harbor (SSH vào server):

```bash
# Gỡ bản cũ nếu có
sudo apt remove $(dpkg --get-selections docker.io docker-compose docker-compose-v2 docker-doc docker-buildx podman-docker containerd runc | cut -f1)

# Cài các gói cần thiết
sudo apt update
sudo apt install -y ca-certificates curl

# Thêm GPG key và repo chính thức của Docker
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

# Cài Docker Engine + Docker Compose plugin
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Kiểm tra
docker --version
docker compose version

# (Tuỳ chọn) cho phép user hiện tại chạy docker không cần sudo
sudo usermod -aG docker $USER
newgrp docker
```

---

## 3. Tải và cấu hình Harbor

### 3.1. Tải bản offline installer

```bash
# Kiểm tra version mới nhất tại https://github.com/goharbor/harbor/releases trước khi tải
wget https://github.com/goharbor/harbor/releases/download/v2.13.1/harbor-offline-installer-v2.13.1.tgz
tar xzvf harbor-offline-installer-v2.13.1.tgz
cd harbor
cp harbor.yml.tmpl harbor.yml
```

### 3.2. Chuẩn bị certificate

#### [DOMAIN] Dùng Let's Encrypt

Đảm bảo domain (ví dụ `harbor.yourdomain.com`) đã trỏ A record về IP server, sau đó:

```bash
sudo apt install certbot -y
sudo certbot certonly --standalone -d harbor.yourdomain.com
# Cert sinh ra tại: /etc/letsencrypt/live/harbor.yourdomain.com/fullchain.pem
#                    /etc/letsencrypt/live/harbor.yourdomain.com/privkey.pem
```

#### [IP] Tự tạo self-signed certificate

Thay `192.168.1.100` bằng IP thật của server bạn trong toàn bộ phần này:

```bash
mkdir -p /etc/harbor/ssl && cd /etc/harbor/ssl

# 1. Tạo CA (Certificate Authority) riêng
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 \
  -out ca.crt -subj "/C=VN/O=ElectronicsShop/CN=Harbor-Local-CA"

# 2. Tạo private key + CSR cho Harbor
openssl genrsa -out harbor.key 4096
openssl req -new -key harbor.key -out harbor.csr \
  -subj "/C=VN/O=ElectronicsShop/CN=192.168.1.100"

# 3. File cấu hình SAN — bắt buộc, Docker/Go từ chối cert thiếu SAN
cat > harbor.ext <<EOF
subjectAltName = IP:192.168.1.100
EOF

# 4. Ký cert bằng CA vừa tạo
openssl x509 -req -in harbor.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out harbor.crt -days 3650 -sha256 \
  -extfile harbor.ext

chmod 644 harbor.crt harbor.key
```

Ta sẽ dùng lại `ca.crt` ở bước 6 để cấu hình các máy client tin cậy registry này.

### 3.3. Sửa `harbor.yml`

#### [DOMAIN]

```yaml
hostname: harbor.yourdomain.com

https:
  port: 443
  certificate: /etc/letsencrypt/live/harbor.yourdomain.com/fullchain.pem
  private_key: /etc/letsencrypt/live/harbor.yourdomain.com/privkey.pem

harbor_admin_password: <đặt mật khẩu admin mạnh>
database:
  password: <đặt password DB nội bộ của Harbor>
data_volume: /data/harbor
```

#### [IP]

```yaml
hostname: 192.168.1.100

https:
  port: 443
  certificate: /etc/harbor/ssl/harbor.crt
  private_key: /etc/harbor/ssl/harbor.key

harbor_admin_password: <đặt mật khẩu admin mạnh>
database:
  password: <đặt password DB nội bộ của Harbor>
data_volume: /data/harbor
```

---

## 4. Cài đặt Harbor

```bash
cd harbor
sudo ./install.sh --with-trivy
```

`--with-trivy` bật sẵn tính năng quét lỗ hổng bảo mật (CVE) ngay khi image được push lên — phù hợp với quy trình DevSecOps hiện có của project.

Truy cập thử:
- **[DOMAIN]** `https://harbor.yourdomain.com`
- **[IP]** `https://192.168.1.100` — trình duyệt sẽ cảnh báo "not trusted" vì tự ký, bấm **Advanced → Proceed**, đây là bình thường.

Đăng nhập bằng `admin` / mật khẩu đã đặt trong `harbor.yml`.

---

## 5. Tạo Project và Robot Account

1. Harbor UI → **Projects** → **New Project** → đặt tên `electronics-shop`, chọn **Private**.
2. Vào project → tab **Robot Accounts** → **New Robot Account**:
   - Tên: `ci-cd`
   - Quyền: **Push Artifact** + **Pull Artifact**
   - Copy lại `robot$electronics-shop+ci-cd` và **token** — chỉ hiện **một lần duy nhất**.

Dùng robot account này cho CI/CD, không dùng tài khoản `admin`.

---

## 6. Cấu hình máy client để push/pull image

Mọi máy cần `docker push`/`docker pull` tới Harbor (máy dev, server deploy app) đều phải được cấu hình theo đúng hệ điều hành/runtime đang dùng.

### 6.1. Máy Linux chạy Docker Engine trực tiếp

#### [DOMAIN]
Không cần làm gì thêm — Let's Encrypt đã được các hệ thống tin cậy sẵn.

#### [IP]
Copy `ca.crt` (tạo ở bước 3.2) từ server Harbor sang máy client, rồi:

```bash
sudo mkdir -p /etc/docker/certs.d/192.168.1.100
sudo cp ca.crt /etc/docker/certs.d/192.168.1.100/ca.crt
sudo systemctl restart docker
```

### 6.2. Máy Windows dùng Docker Desktop (WSL2 integration)

> **Lưu ý quan trọng:** Docker daemon của Docker Desktop chạy trong VM riêng, không phải trong distro WSL2. Copy cert vào `/etc/docker/certs.d/` bên trong WSL2 **không có tác dụng** — phải cấu hình phía Windows.

#### [DOMAIN]
Không cần làm gì thêm.

#### [IP]

1. Copy `ca.crt` ra Windows (chạy trong WSL2):
   ```bash
   cp ca.crt /mnt/c/Users/<TenUserWindows>/Desktop/harbor-ca.crt
   ```

2. Import vào Windows Certificate Store — mở **PowerShell chạy quyền Administrator**:
   ```powershell
   certutil -addstore -f "ROOT" "C:\Users\<TenUserWindows>\Desktop\harbor-ca.crt"
   ```

   Hoặc bằng GUI: click đúp file `.crt` → **Install Certificate** → **Local Machine** → **Place all certificates in the following store** → Browse → **Trusted Root Certification Authorities** → OK → Next → Finish.

   > Phải chọn **Local Machine**, không phải **Current User** — Docker Desktop VM chạy dưới quyền hệ thống, chỉ đọc kho chứng chỉ Local Machine.

3. Restart Docker Desktop (chuột phải icon khay hệ thống → **Restart**) để nó đồng bộ lại chứng chỉ vào VM nội bộ.

4. Kiểm tra lại trong WSL2: `docker version` → xác nhận `Server:` là `desktop-linux`.

**Phương án thay thế (kém an toàn hơn, chỉ dùng khi test nhanh):** Docker Desktop → **Settings → Docker Engine**, thêm vào `daemon.json`:
```json
{
  "insecure-registries": ["192.168.1.100"]
}
```
rồi **Apply & Restart**. Cách này bỏ qua kiểm tra TLS hoàn toàn cho registry, không khuyến khích dùng lâu dài.

---

## 7. Test push/pull

Từ bất kỳ máy client nào đã cấu hình ở bước 6, chạy từ thư mục gốc project (để đúng build context mà Dockerfile yêu cầu):

```bash
# Thay <registry> = domain hoặc IP tuỳ trường hợp bạn dùng
docker login <registry> -u 'robot$electronics-shop+ci-cd' -p '<token>'

docker build -f docker/backend.Dockerfile -t <registry>/electronics-shop/backend:v1 .
docker push <registry>/electronics-shop/backend:v1

docker build -f docker/frontend.Dockerfile -t <registry>/electronics-shop/frontend:v1 .
docker push <registry>/electronics-shop/frontend:v1
```

Push thành công → image xuất hiện trong Harbor UI, tab **Vulnerability** sẽ hiện kết quả scan Trivy tự động.

---

## 8. Tích hợp vào GitHub Actions

Thêm secrets vào repo (**Settings → Secrets and variables → Actions**):

| Secret | Giá trị |
|---|---|
| `HARBOR_REGISTRY` | domain hoặc IP của Harbor |
| `HARBOR_ROBOT_USER` | `robot$electronics-shop+ci-cd` |
| `HARBOR_ROBOT_TOKEN` | token robot account ở bước 5 |
| `NEXT_PUBLIC_API_URL` | URL backend thật (dùng khi build frontend) |
| `HARBOR_CA_CERT` | **[IP] only** — nội dung `ca.crt`, encode base64: `base64 -w0 ca.crt` |

Workflow build & push đã được cấu hình sẵn tại [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml).

Nếu dùng nhánh **[IP]**, cần thêm step sau **trước** step `Login vào Harbor` trong `deploy.yml` để GitHub Actions runner (máy ảo mới mỗi lần chạy) tin cậy CA tự ký:

```yaml
      - name: Trust Harbor self-signed CA
        run: |
          echo "${{ secrets.HARBOR_CA_CERT }}" | base64 -d | sudo tee /usr/local/share/ca-certificates/harbor-ca.crt
          sudo update-ca-certificates
          sudo mkdir -p /etc/docker/certs.d/${{ secrets.HARBOR_REGISTRY }}
          echo "${{ secrets.HARBOR_CA_CERT }}" | base64 -d | sudo tee /etc/docker/certs.d/${{ secrets.HARBOR_REGISTRY }}/ca.crt
```

---

## 9. Gỡ bỏ / dọn dẹp certificate

Chỉ áp dụng cho nhánh **[IP]** (self-signed), khi cần thu hồi tin cậy khỏi một máy client.

### Máy Linux (Docker Engine)

```bash
sudo rm -rf /etc/docker/certs.d/192.168.1.100
sudo systemctl restart docker
```

### Máy Windows (Docker Desktop)

**GUI:** `Windows + R` → `certlm.msc` → **Trusted Root Certification Authorities** → **Certificates** → tìm cert `Harbor-Local-CA` → chuột phải → **Delete**.

**PowerShell (Admin):**
```powershell
Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*Harbor*" } | Remove-Item
```

Sau đó restart lại Docker Desktop. Từ lúc này máy sẽ không còn push/pull được tới Harbor bằng IP đó nữa (báo lỗi `x509: certificate signed by unknown authority`) — việc gỡ này **không ảnh hưởng** tới chính Harbor server, chỉ gỡ tin cậy phía máy client.

---

## 10. Bảo trì

- **Tag Retention:** Harbor UI → project → **Tag Retention**, đặt rule (vd: giữ 10 bản mới nhất theo SHA) để tránh đầy disk vì mỗi lần CI chạy đều push tag mới.
- **Gia hạn Let's Encrypt (nhánh [DOMAIN]):** cert hết hạn sau 90 ngày, thiết lập cron gia hạn tự động:
  ```bash
  sudo certbot renew --dry-run   # test trước
  # thêm vào crontab: 0 3 * * * certbot renew --quiet && docker restart nginx
  ```
- **Backup:** thư mục `data_volume` (mặc định `/data/harbor`) chứa toàn bộ image và database, nên backup định kỳ.