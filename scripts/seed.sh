#!/bin/bash
# Seed database với dữ liệu mẫu
# Chạy từ root project: bash scripts/seed.sh

set -e

# ── Đảm bảo dùng đúng Node.js do nvm quản lý ────────────────────────────
# Khi script này được gọi như 1 "interactive shell" (gõ trực tiếp trong
# terminal WSL), bash tự đọc ~/.bashrc, nơi nvm chèn sẵn code thêm Node
# đúng version vào PATH -> chạy đúng.
# Nhưng khi bị gọi như 1 "non-interactive shell" (vd: từ PowerShell trên
# Windows gọi ngầm qua wsl.exe/bash.exe để thực thi script), bash KHÔNG tự
# đọc ~/.bashrc theo quy ước mặc định -> PATH không có Node do nvm quản lý
# -> "node"/"npx" rơi về 1 bản Node hệ thống khác (có thể rất cũ, gây lỗi
# cú pháp khó hiểu như "Unexpected token '?'" với TypeScript/ts-node).
#
# Tự source nvm ở đây để đảm bảo PATH luôn đúng, bất kể script được gọi
# theo cách nào.
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  \. "$NVM_DIR/nvm.sh"
fi

echo "🌱 Chạy seed dữ liệu..."
echo "   (node: $(command -v node) — $(node -v 2>/dev/null || echo 'không tìm thấy'))"

cd "$(dirname "$0")/../backend"

# Kiểm tra .env
if [ ! -f .env ]; then
  echo "❌ Không tìm thấy backend/.env — hãy copy từ .env.example và điền thông tin"
  exit 1
fi

npx ts-node src/database/seeds/run-seeds.ts