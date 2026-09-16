#!/bin/bash
# scripts/setup-harbor-ec2.sh
#
# Chạy TỪ MÁY HOST KHÔNG chạy trên EC2) — SSH vào EC2 Harbor rồi cài
# đặt Harbor từ xa, dùng Public DNS mà AWS tự cấp cho EC2
# (dạng ec2-x-x-x-x.<region>.compute.amazonaws.com) làm
# "domain" để xin chứng chỉ Let's Encrypt, KHÔNG dùng IP/self-signed —
# Public DNS này Let's Encrypt xác minh HTTP-01 challenge được bình
# thường vì nó trỏ đúng về chính EC2 đó, không cần ta phải sở hữu domain riêng.
#
# ĐIỀU KIỆN CẦN TRƯỚC KHI CHẠY:
#   - EC2 Ubuntu 22.04/24.04 (≥2 vCPU, ≥4GB RAM, ≥40GB disk) đã tạo trong
#     PUBLIC SUBNET, đã gắn Public IPv4 (Auto-assign public IP = Enable lúc
#     tạo, hoặc gắn Elastic IP).
#   - Lấy đúng "Public IPv4 DNS" ở EC2 console (KHÔNG phải Public IPv4
#     address) — script sẽ hỏi giá trị này.
#   - Security Group của EC2 đã mở inbound: 22 (SSH, chỉ IP của bạn), 80
#     (HTTP — Let's Encrypt HTTP-01 challenge bắt buộc cần mở), 443 (HTTPS —
#     Harbor UI/registry). Script này KHÔNG tự tạo Security Group.
#   - Có sẵn key pair (.pem) đã dùng lúc tạo EC2 để SSH vào.
#
# Chạy: bash scripts/setup-harbor-ec2.sh

set -e

# ────────────────────────────────────────────────────────────────────────
# NHẬP GIÁ TRỊ KHI SCRIPT CHẠY
# ────────────────────────────────────────────────────────────────────────
read -r -p "Public IPv4 DNS của EC2 (vd ec2-13-250-100-12.ap-southeast-1.compute.amazonaws.com): " EC2_PUBLIC_DNS
while [ -z "$EC2_PUBLIC_DNS" ]; do
  read -r -p "Public IPv4 DNS (bắt buộc, không được để trống): " EC2_PUBLIC_DNS
done

read -r -p "Đường dẫn file .pem để SSH: " SSH_KEY_PATH
while [ ! -f "$SSH_KEY_PATH" ]; do
  read -r -p "Không tìm thấy file, nhập lại đường dẫn .pem: " SSH_KEY_PATH
done

read -r -p "SSH user [ubuntu]: " SSH_USER
SSH_USER="${SSH_USER:-ubuntu}"

read -r -p "Harbor version [v2.13.1] (kiểm tra bản mới nhất tại https://github.com/goharbor/harbor/releases): " HARBOR_VERSION
HARBOR_VERSION="${HARBOR_VERSION:-v2.13.1}"

read -r -p "Email dùng để đăng ký Let's Encrypt (nhận cảnh báo cert sắp hết hạn): " CERTBOT_EMAIL
while [ -z "$CERTBOT_EMAIL" ]; do
  read -r -p "Email (bắt buộc, Let's Encrypt yêu cầu): " CERTBOT_EMAIL
done

read -r -s -p "Đặt mật khẩu admin Harbor (ẩn khi gõ): " HARBOR_ADMIN_PASSWORD
echo ""
read -r -s -p "Nhập lại mật khẩu admin Harbor để xác nhận: " HARBOR_ADMIN_PASSWORD_CONFIRM
echo ""
while [ "$HARBOR_ADMIN_PASSWORD" != "$HARBOR_ADMIN_PASSWORD_CONFIRM" ] || [ -z "$HARBOR_ADMIN_PASSWORD" ]; do
  echo "2 lần nhập không khớp hoặc để trống, thử lại."
  read -r -s -p "Đặt mật khẩu admin Harbor (ẩn khi gõ): " HARBOR_ADMIN_PASSWORD
  echo ""
  read -r -s -p "Nhập lại để xác nhận: " HARBOR_ADMIN_PASSWORD_CONFIRM
  echo ""
done

read -r -s -p "Đặt password DB nội bộ của Harbor (ẩn khi gõ): " HARBOR_DB_PASSWORD
echo ""
read -r -s -p "Nhập lại password DB để xác nhận: " HARBOR_DB_PASSWORD_CONFIRM
echo ""
while [ "$HARBOR_DB_PASSWORD" != "$HARBOR_DB_PASSWORD_CONFIRM" ] || [ -z "$HARBOR_DB_PASSWORD" ]; do
  echo "2 lần nhập không khớp hoặc để trống, thử lại."
  read -r -s -p "Đặt password DB nội bộ (ẩn khi gõ): " HARBOR_DB_PASSWORD
  echo ""
  read -r -s -p "Nhập lại để xác nhận: " HARBOR_DB_PASSWORD_CONFIRM
  echo ""
done
# ────────────────────────────────────────────────────────────────────────

echo ""
echo "=== Kiểm tra SSH vào EC2 ==="
chmod 400 "$SSH_KEY_PATH"
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 \
  "$SSH_USER@$EC2_PUBLIC_DNS" "echo 'SSH OK — đang chạy trên:' && hostname"

echo ""
echo "=== Chạy cài đặt Harbor từ xa trên $EC2_PUBLIC_DNS (mất khoảng 5-10 phút) ==="

# Toàn bộ khối bên dưới được build ở MÁY HOST (biến local được thay giá trị
# thật vào TRƯỚC khi gửi qua SSH — vì heredoc "REMOTE_EOF" không có dấu
# nháy quanh delimiter, bash sẽ tự expand $EC2_PUBLIC_DNS/$HARBOR_VERSION/...
# ngay tại đây, không phải trên server), sau đó pipe nguyên khối lệnh này
# cho server thực thi qua "bash -s".
ssh -i "$SSH_KEY_PATH" "$SSH_USER@$EC2_PUBLIC_DNS" bash -s <<REMOTE_EOF
set -e

echo "--- [remote] 1. Cài Docker Engine + Compose ---"
sudo apt remove -y \$(dpkg --get-selections docker.io docker-compose docker-compose-v2 docker-doc docker-buildx podman-docker containerd runc 2>/dev/null | cut -f1) 2>/dev/null || true

sudo apt update
sudo apt install -y ca-certificates curl certbot

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<APT_EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: \${UBUNTU_CODENAME:-\$VERSION_CODENAME}
Components: stable
Architectures: \$(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
APT_EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker \$USER

docker --version
sudo docker compose version

echo "--- [remote] 2. Xin chứng chỉ Let's Encrypt cho $EC2_PUBLIC_DNS ---"
sudo certbot certonly --standalone -d "$EC2_PUBLIC_DNS" \
  --non-interactive --agree-tos -m "$CERTBOT_EMAIL"

echo "--- [remote] 3. Tải + cấu hình Harbor $HARBOR_VERSION ---"
cd ~
wget -q "https://github.com/goharbor/harbor/releases/download/$HARBOR_VERSION/harbor-offline-installer-$HARBOR_VERSION.tgz"
tar xzf "harbor-offline-installer-$HARBOR_VERSION.tgz"
cd harbor
cp harbor.yml.tmpl harbor.yml

sudo sed -i \
  -e "s|^hostname: .*|hostname: $EC2_PUBLIC_DNS|" \
  -e "s|^  certificate: .*|  certificate: /etc/letsencrypt/live/$EC2_PUBLIC_DNS/fullchain.pem|" \
  -e "s|^  private_key: .*|  private_key: /etc/letsencrypt/live/$EC2_PUBLIC_DNS/privkey.pem|" \
  -e "s|^harbor_admin_password: .*|harbor_admin_password: $HARBOR_ADMIN_PASSWORD|" \
  -e "s|^  password: root123|  password: $HARBOR_DB_PASSWORD|" \
  -e "s|^data_volume: .*|data_volume: /data/harbor|" \
  harbor.yml

echo "--- [remote] Kiểm tra lại các dòng vừa sửa trong harbor.yml (tự soát lại bằng mắt) ---"
grep -E "^hostname:|^  certificate:|^  private_key:|^harbor_admin_password:|^data_volume:" harbor.yml

echo "--- [remote] 4. Cài đặt Harbor (bật kèm Trivy) ---"
sudo ./install.sh --with-trivy

echo "--- [remote] 5. Cron gia hạn Let's Encrypt tự động ---"
( sudo crontab -l 2>/dev/null | grep -v 'certbot renew' ; echo "0 3 * * * certbot renew --quiet && docker restart nginx" ) | sudo crontab -

echo "--- [remote] XONG ---"
REMOTE_EOF

echo ""
echo "=================================================================="
echo "  CÀI XONG. Truy cập: https://$EC2_PUBLIC_DNS"
echo "  Đăng nhập: admin / <mật khẩu admin bạn vừa đặt>"
echo ""
echo "  BƯỚC TAY CÒN LẠI (không tự động hoá được, làm trên UI):"
echo "  1) Projects -> New Project -> tên \"electronics-shop\" -> Private"
echo "  2) Vào project -> tab Robot Accounts -> New Robot Account -> tên"
echo "     \"ci-cd\", quyền Push + Pull Artifact -> copy lại user/token (chỉ"
echo "     hiện 1 lần)"
echo "  3) Thêm/chỉnh sửa secrets trong GitHub repo (Settings -> Secrets -> Actions):"
echo "       HARBOR_REGISTRY   = $EC2_PUBLIC_DNS"
echo "       HARBOR_ROBOT_USER = robot\$electronics-shop+ci-cd"
echo "       HARBOR_ROBOT_TOKEN = <token vừa copy>"
echo "  (Không cần thêm HARBOR_CA_CERT — dùng Let's Encrypt, không phải"
echo "  self-signed, các máy client/CI đã tin cậy sẵn.)"
echo "=================================================================="