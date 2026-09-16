#!/bin/bash
# scripts/setup-harbor-ec2.sh
#
# Chạy TỪ MÁY HOST (KHÔNG chạy trên EC2) — SSH vào EC2 Harbor rồi cài
# đặt Harbor từ xa.
#
# QUAN TRỌNG: Let's Encrypt CHẶN HẲN việc cấp cert cho domain dưới
# "*.amazonaws.com" (và domain mặc định của nhiều cloud provider khác) —
# chính sách chống lạm dụng, không phải lỗi cấu hình. Vì vậy KHÔNG dùng
# Public DNS AWS tự cấp để xin cert được — phải tạo domain riêng (miễn phí
# qua dynv6.net) trỏ A record về IP của EC2 này.
# Script tách riêng 2 khái niệm:
#   - SSH_HOST : địa chỉ để SSH VÀO EC2 — dùng IP hoặc AWS Public DNS đều
#     được, không liên quan gì tới giới hạn của Let's Encrypt (giới hạn đó
#     chỉ áp dụng lúc xin cert, không áp dụng lúc SSH).
#   - HARBOR_DOMAIN : domain dynv6 dùng làm hostname Harbor + xin cert.
#
# ĐIỀU KIỆN CẦN TRƯỚC KHI CHẠY:
#   - EC2 Ubuntu 22.04/24.04 (≥2 vCPU, ≥4GB RAM, ≥40GB disk) đã tạo trong
#     PUBLIC SUBNET, đã gắn Elastic IP (khuyến nghị — Public IP thường sẽ đổi
#     mỗi lần stop/start EC2, làm sai A record đã trỏ).
#   - Security Group của EC2 đã mở inbound: 22 (SSH, chỉ IP của bạn), 80
#     (HTTP — Let's Encrypt HTTP-01 challenge bắt buộc cần mở), 443 (HTTPS —
#     Harbor UI/registry). Script này KHÔNG tự tạo Security Group.
#   - Có sẵn key pair (.pem) đã dùng lúc tạo EC2 để SSH vào.
#   - Đã tạo zone trên dynv6.com — CHƯA cần tạo A
#     record vội, script sẽ dừng lại đúng lúc cần và cho ta biết IP thật để
#     trỏ.
#
# Chạy: bash scripts/setup-harbor-ec2.sh

set -e

# ────────────────────────────────────────────────────────────────────────
# NHẬP GIÁ TRỊ KHI SCRIPT CHẠY
# ────────────────────────────────────────────────────────────────────────
read -r -p "Địa chỉ để SSH vào EC2 (Public IPv4 hoặc Public IPv4 DNS, lấy ở EC2 console): " SSH_HOST
while [ -z "$SSH_HOST" ]; do
  read -r -p "Địa chỉ SSH (bắt buộc, không được để trống): " SSH_HOST
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
  "$SSH_USER@$SSH_HOST" "echo 'SSH OK — đang chạy trên:' && hostname"

echo ""
echo "=== Lấy Public IP thật của EC2 (để trỏ A record) ==="
EC2_PUBLIC_IP=$(ssh -i "$SSH_KEY_PATH" "$SSH_USER@$SSH_HOST" "curl -s https://checkip.amazonaws.com")
echo "Public IP: $EC2_PUBLIC_IP"

echo ""
echo "=================================================================="
echo "  DỪNG LẠI — cần làm tay trước khi script tiếp tục:"
echo ""
echo "  1) Vào dynv6.com -> zone đã tạo -> Records -> Add Record"
echo "  2) Tạo bản ghi A:"
echo "       Name: harbor (hoặc tên bạn muốn)"
echo "       Type: A"
echo "       Data: $EC2_PUBLIC_IP"
echo "  3) Chờ vài phút cho DNS lan truyền, kiểm tra bằng:"
echo "       dig +short <domain-bạn-vừa-tạo>"
echo "     Phải trả về đúng $EC2_PUBLIC_IP"
echo "=================================================================="
read -r -p "Đã tạo xong A record và dig ra đúng IP rồi, nhập domain Harbor (vd harbor.techshop.dynv6.net): " HARBOR_DOMAIN
while [ -z "$HARBOR_DOMAIN" ]; do
  read -r -p "Domain Harbor (bắt buộc, không được để trống): " HARBOR_DOMAIN
done

echo ""
echo "=== Chạy cài đặt Harbor từ xa trên $SSH_HOST (mất khoảng 5-10 phút) ==="

# Toàn bộ khối bên dưới được build ở MÁY HOST (biến local được thay giá trị
# thật vào TRƯỚC khi gửi qua SSH — vì heredoc "REMOTE_EOF" không có dấu
# nháy quanh delimiter, bash sẽ tự expand $HARBOR_DOMAIN/$HARBOR_VERSION/...
# ngay tại đây, không phải trên server), sau đó pipe nguyên khối lệnh này
# cho server thực thi qua "bash -s".
ssh -i "$SSH_KEY_PATH" "$SSH_USER@$SSH_HOST" bash -s <<REMOTE_EOF
set -e

echo "--- [remote] 0. Kiểm tra DNS đã trỏ đúng trước khi tốn lượt xin cert (Let's Encrypt có rate limit) ---"
RESOLVED_IP=\$(getent hosts "$HARBOR_DOMAIN" | awk '{print \$1}' || true)
if [ "\$RESOLVED_IP" != "$EC2_PUBLIC_IP" ]; then
  echo "CẢNH BÁO: $HARBOR_DOMAIN hiện phân giải ra '\$RESOLVED_IP', không khớp $EC2_PUBLIC_IP."
  echo "DNS có thể chưa lan truyền xong. Certbot phía dưới nhiều khả năng sẽ lỗi."
  read -p "Vẫn muốn tiếp tục? (y/N): " CONTINUE_ANYWAY
  if [ "\$CONTINUE_ANYWAY" != "y" ] && [ "\$CONTINUE_ANYWAY" != "Y" ]; then
    echo "Dừng lại. Chờ DNS lan truyền xong rồi chạy lại script."
    exit 1
  fi
fi

echo "--- [remote] 1. Cài Docker Engine + Compose ---"
sudo apt remove -y \$(dpkg --get-selections docker.io docker-compose docker-compose-v2 docker-doc docker-buildx podman-docker containerd runc 2>/dev/null | cut -f1) 2>/dev/null || true

sudo apt update
sudo apt install -y ca-certificates curl certbot dnsutils

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

echo "--- [remote] 2. Xin chứng chỉ Let's Encrypt cho $HARBOR_DOMAIN ---"
sudo certbot certonly --standalone -d "$HARBOR_DOMAIN" \
  --non-interactive --agree-tos -m "$CERTBOT_EMAIL"

echo "--- [remote] 3. Tải + cấu hình Harbor $HARBOR_VERSION ---"
cd ~
wget -q "https://github.com/goharbor/harbor/releases/download/$HARBOR_VERSION/harbor-offline-installer-$HARBOR_VERSION.tgz"
tar xzf "harbor-offline-installer-$HARBOR_VERSION.tgz"
cd harbor
cp harbor.yml.tmpl harbor.yml

sudo sed -i \
  -e "s|^hostname: .*|hostname: $HARBOR_DOMAIN|" \
  -e "s|^  certificate: .*|  certificate: /etc/letsencrypt/live/$HARBOR_DOMAIN/fullchain.pem|" \
  -e "s|^  private_key: .*|  private_key: /etc/letsencrypt/live/$HARBOR_DOMAIN/privkey.pem|" \
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
echo "  CÀI XONG. Truy cập: https://$HARBOR_DOMAIN"
echo "  Đăng nhập: admin / <mật khẩu admin bạn vừa đặt>"
echo ""
echo "  BƯỚC TAY CÒN LẠI (không tự động hoá được, làm trên UI):"
echo "  1) Projects -> New Project -> tên \"electronics-shop\" -> Private"
echo "  2) Vào project -> tab Robot Accounts -> New Robot Account -> tên"
echo "     \"ci-cd\", quyền Push + Pull Artifact -> copy lại user/token (chỉ"
echo "     hiện 1 lần)"
echo "  3) Thêm/chỉnh sửa secrets trong GitHub repo (Settings -> Secrets -> Actions):"
echo "       HARBOR_REGISTRY   = $HARBOR_DOMAIN"
echo "       HARBOR_ROBOT_USER = robot\$electronics-shop+ci-cd"
echo "       HARBOR_ROBOT_TOKEN = <token vừa copy>"
echo "  (Không cần thêm HARBOR_CA_CERT — dùng Let's Encrypt, không phải"
echo "  self-signed, các máy client/CI đã tin cậy sẵn.)"
echo ""
echo "  Nếu sau này Public IP EC2 đổi (do không dùng Elastic IP), vào lại"
echo "  dynv6.com sửa A record cho \"$HARBOR_DOMAIN\" trỏ IP mới, KHÔNG cần"
echo "  xin lại cert (cert gắn theo domain, không gắn theo IP)."
echo "=================================================================="