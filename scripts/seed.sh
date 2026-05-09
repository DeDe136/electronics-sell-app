#!/bin/bash
# Seed database với dữ liệu mẫu
# Chạy từ root project: bash scripts/seed.sh

set -e

echo "🌱 Chạy seed dữ liệu..."

cd "$(dirname "$0")/../backend"

# Kiểm tra .env
if [ ! -f .env ]; then
  echo "❌ Không tìm thấy backend/.env — hãy copy từ .env.example và điền thông tin"
  exit 1
fi

npx ts-node src/database/seeds/run-seeds.ts