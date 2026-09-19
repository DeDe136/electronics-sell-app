#!/bin/bash
# scripts/seed-rds-via-bastion.sh
#
# Chạy TỪ MÁY HOST (KHÔNG chạy trên bastion) — rsync code backend/
# từ máy host sang bastion EC2), rồi chạy seed script
# (backend/src/database/seeds/run-seeds.ts) từ đó, kết nối thẳng vào RDS
#
# Script idempotent — chạy lại nhiều lần an toàn: rsync chỉ đồng bộ phần
# thay đổi, Node.js chỉ cài lại nếu chưa có.
#
# ĐIỀU KIỆN CẦN TRƯỚC KHI CHẠY:
#   - EC2 bastion (Ubuntu 22.04/24.04, cấu hình nhỏ vd t3.micro là đủ) đã
#     tạo, đặt trong PUBLIC SUBNET (để SSH được) hoặc PRIVATE SUBNET có
#     đường ra Internet qua NAT Gateway (để cài Node.js/npm install được).
#   - Security Group của bastion mở inbound 22 (SSH, chỉ IP của mình).
#   - Security Group của RDS (techshop-rds-sg) đã cho phép inbound port 5432
#     TỪ Security Group của bastion — bổ sung thêm rule này bên cạnh rule đã
#     cho phép Security Group của node EKS, KHÔNG thay thế.
#   - Có sẵn key pair (.pem) để SSH vào bastion.
#   - Máy host đã cài "rsync" (có sẵn trên macOS/Linux; trên Windows chạy
#     qua WSL hoặc Git Bash có cài thêm rsync).
#   - File backend/certs/global-bundle.pem đã tải về — cần để seed script kết nối SSL vào RDS.
#
# Chạy: bash scripts/seed-rds-via-bastion.sh

set -e

# ────────────────────────────────────────────────────────────────────────
# NHẬP GIÁ TRỊ KHI SCRIPT CHẠY
# ────────────────────────────────────────────────────────────────────────
read -r -p "Địa chỉ SSH vào bastion (Public IPv4 hoặc Public IPv4 DNS): " SSH_HOST
while [ -z "$SSH_HOST" ]; do
  read -r -p "Địa chỉ SSH (bắt buộc, không được để trống): " SSH_HOST
done

read -r -p "Đường dẫn file .pem để SSH: " SSH_KEY_PATH
while [ ! -f "$SSH_KEY_PATH" ]; do
  read -r -p "Không tìm thấy file, nhập lại đường dẫn .pem: " SSH_KEY_PATH
done

read -r -p "SSH user [ubuntu]: " SSH_USER
SSH_USER="${SSH_USER:-ubuntu}"

read -r -p "Đường dẫn thư mục backend/ trên máy host [./backend]: " LOCAL_BACKEND_DIR
LOCAL_BACKEND_DIR="${LOCAL_BACKEND_DIR:-./backend}"
while [ ! -d "$LOCAL_BACKEND_DIR" ]; do
  read -r -p "Không tìm thấy thư mục, nhập lại đường dẫn backend/: " LOCAL_BACKEND_DIR
done

read -r -p "RDS endpoint (SEED_DB_HOST): " RDS_HOST
while [ -z "$RDS_HOST" ]; do
  read -r -p "RDS endpoint (bắt buộc, không được để trống): " RDS_HOST
done

read -r -p "DB port [5432]: " DB_PORT
DB_PORT="${DB_PORT:-5432}"

read -r -p "DB username: " DB_USERNAME
while [ -z "$DB_USERNAME" ]; do
  read -r -p "DB username (bắt buộc): " DB_USERNAME
done

read -r -s -p "DB password (ẩn khi gõ): " DB_PASSWORD
echo ""
while [ -z "$DB_PASSWORD" ]; do
  read -r -s -p "DB password (bắt buộc, ẩn khi gõ): " DB_PASSWORD
  echo ""
done

read -r -p "DB name [electronics_shop]: " DB_NAME
DB_NAME="${DB_NAME:-electronics_shop}"
# ────────────────────────────────────────────────────────────────────────

if [ ! -f "$LOCAL_BACKEND_DIR/certs/global-bundle.pem" ]; then
  echo "Thiếu $LOCAL_BACKEND_DIR/certs/global-bundle.pem — RDS bắt buộc SSL,"
  echo "seed script cần file này để kết nối được."
  exit 1
fi

echo ""
echo "=== Kiểm tra SSH vào bastion ==="
chmod 400 "$SSH_KEY_PATH"
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 \
  "$SSH_USER@$SSH_HOST" "mkdir -p ~/app/backend && echo 'SSH OK — đang chạy trên:' && hostname"

echo ""
echo "=== Đồng bộ code backend/ từ máy host sang bastion (rsync, không dùng git) ==="
# Loại trừ node_modules/dist/.env — cài lại "npm ci" trên bastion cho đúng
# kiến trúc CPU của bastion (rsync node_modules từ máy host có thể build
# sai kiến trúc nếu 2 máy khác OS/CPU), và .env local không nên lẫn vào máy
# khác (nếu bastion cần biến môi trường gì, script này đã tự export ở bước
# chạy seed bên dưới, không cần .env).
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.env' \
  -e "ssh -i $SSH_KEY_PATH" \
  "$LOCAL_BACKEND_DIR/" "$SSH_USER@$SSH_HOST:~/app/backend/"

echo ""
echo "=== Chạy seed từ xa trên $SSH_HOST ==="

# Các biến local ($GIT_REPO_URL, $RDS_HOST, $DB_PASSWORD...) được thay giá
# trị thật vào TRƯỚC khi gửi qua SSH (heredoc "REMOTE_EOF" không có dấu
# nháy quanh delimiter) — xem giải thích chi tiết hơn trong
# scripts/setup-harbor-ec2.sh nếu cần ôn lại cơ chế này.
ssh -i "$SSH_KEY_PATH" "$SSH_USER@$SSH_HOST" bash -s <<REMOTE_EOF
set -e

echo "--- [remote] 1. Cài Node.js 20 (nếu chưa có) ---"
if ! command -v node >/dev/null 2>&1 || [ "\$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
else
  echo "Node.js \$(node -v) đã có sẵn, bỏ qua."
fi

echo "--- [remote] 2. Cài dependencies backend (code đã rsync sẵn ở bước trước) ---"
cd "\$HOME/app/backend"
npm ci

echo "--- [remote] 3. Chạy seed, trỏ thẳng vào RDS ---"
# STORAGE_PROVIDER=aws — khiến buildSeedImageUrl() trong
# category.seed.ts/product.seed.ts trả về "/api/images/{key}" thay vì URL
# MinIO local, khớp đúng cơ chế frontend đọc ảnh qua S3 khi deploy EKS.
# SEED_SSL=true — RDS bắt buộc SSL, xem trong run-seeds.ts.
SEED_DB_HOST="$RDS_HOST" \
DB_PORT="$DB_PORT" \
DB_USERNAME="$DB_USERNAME" \
DB_PASSWORD="$DB_PASSWORD" \
DB_NAME="$DB_NAME" \
STORAGE_PROVIDER=aws \
SEED_SSL=true \
npx ts-node src/database/seeds/run-seeds.ts

echo "--- [remote] XONG ---"
REMOTE_EOF

echo ""
echo "=================================================================="
echo "  SEED XONG vào RDS ($RDS_HOST/$DB_NAME)."
echo "  Code trên bastion nằm ở ~/app/backend — lần sau chạy lại script này"
echo "  sẽ tự rsync bản mới nhất từ máy host rồi seed lại, không cần thao"
echo "  tác gì thêm trên bastion."
echo "=================================================================="