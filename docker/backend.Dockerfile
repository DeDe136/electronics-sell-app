# syntax=docker/dockerfile:1
# ============================================================================
# Dockerfile cho BACKEND (NestJS + TypeORM + PostgreSQL)
#
# Build từ thư mục GỐC của project (không phải từ trong /backend), vì các
# lệnh COPY bên dưới dùng đường dẫn "backend/...". Ví dụ:
#   docker build -f docker/backend.Dockerfile -t electronics-shop-backend .
#
# File này dùng kỹ thuật MULTI-STAGE BUILD (nhiều giai đoạn) để:
#   1. Cài đặt & build ở 1 stage riêng (có đầy đủ devDependencies, TypeScript...)
#   2. Cài lại chỉ production dependencies ở 1 stage riêng (nhẹ hơn)
#   3. Copy kết quả build (dist) + node_modules production sang image cuối
#      cùng => image chạy thực tế KHÔNG chứa mã nguồn TypeScript, devDeps,
#      cache npm... giúp image nhỏ gọn và an toàn hơn.
# ============================================================================


# ── STAGE 1: BUILDER ─────────────────────────────────────────────────────
# Mục đích: cài đặt toàn bộ dependencies (kể cả dev) và build TypeScript
# ra JavaScript (thư mục dist/) bằng lệnh "nest build".
FROM node:20-alpine AS builder
WORKDIR /app

# Chỉ copy package.json + package-lock.json trước tiên (chưa copy source code).
# Nhờ vậy, nếu source code thay đổi nhưng package.json không đổi, Docker sẽ
# tận dụng cache của bước "npm ci" bên dưới thay vì cài lại từ đầu
# => build nhanh hơn nhiều lần trong quá trình phát triển.
COPY backend/package.json backend/package-lock.json ./

# npm ci: cài đặt chính xác theo package-lock.json (nhanh & ổn định hơn npm install,
# phù hợp cho môi trường CI/CD và Docker build).
RUN npm ci

# Copy toàn bộ source code backend (src/, tsconfig.json, ...) vào image.
COPY backend/. .

# Build TypeScript -> JavaScript. Kết quả nằm ở thư mục /app/dist
RUN npm run build


# ── STAGE 2: DEPS (chỉ cài production dependencies) ─────────────────────
# Mục đích: tạo ra một bộ node_modules "sạch", chỉ chứa dependencies cần
# thiết để CHẠY app (không có TypeScript, @nestjs/cli, @types/*, ts-node...).
# Làm riêng 1 stage như thế này giúp image cuối cùng nhẹ hơn đáng kể so với
# việc copy nguyên node_modules từ stage "builder" (vốn có cả devDependencies).
FROM node:20-alpine AS deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./

# --omit=dev: chỉ cài "dependencies", bỏ qua "devDependencies"
RUN npm ci --omit=dev && npm cache clean --force


# ── STAGE 3: RUNNER (image chạy thực tế trong production) ───────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Cache-bust: buộc BuildKit chạy lại "apk upgrade" mỗi lần build,
# không dùng lại layer cache cũ (vốn có thể chứa bản vá lỗi thời).
ARG CACHEBUST=1
# Vá OS package ngay tại thời điểm build, KHÔNG trông chờ tag "node:20-alpine"
# trên Docker Hub đã sẵn bản vá — vì GitHub Actions runner luôn build từ máy ảo
# mới hoàn toàn, "apk upgrade" ở đây đảm bảo mọi lần CI chạy đều lấy bản vá CVE
# mới nhất từ kho Alpine tại đúng thời điểm build đó, không phụ thuộc vào việc
# base image trên Docker Hub đã được rebuild lại hay chưa.
RUN apk update && apk upgrade --no-cache

# NODE_ENV=production: giúp các thư viện (Express, NestJS...) tối ưu hiệu năng,
# tắt các log/warning chỉ dùng cho dev.
ENV NODE_ENV=production
# Cổng mà NestJS sẽ lắng nghe (khớp với "app.listen(port)" trong main.ts).
ENV PORT=3001

# dumb-init: một init-process nhỏ gọn, giúp container xử lý đúng các tín hiệu
# hệ thống (SIGTERM, SIGINT khi "docker stop") và tránh hiện tượng "zombie
# process" — vì Node.js khi chạy PID 1 trực tiếp không xử lý signal tốt.
RUN apk add --no-cache dumb-init

# Tạo user & group riêng (không dùng root) để chạy app.
# Đây là best practice bảo mật: nếu app bị khai thác lỗ hổng, kẻ tấn công
# cũng không có quyền root bên trong container.
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Copy node_modules "sạch" (chỉ production deps) từ stage "deps"
#
# --chown=nestjs:nodejs: đổi quyền sở hữu file ngay lúc copy, để file thuộc
# đúng user sẽ chạy app (nestjs) thay vì mặc định thuộc về root.
# Lưu ý: nếu KHÔNG có --chown, file copy vào vẫn mang quyền sở hữu root,
# nhưng thường vẫn "chạy được" vì quyền đọc mặc định (644/755) đã mở sẵn
# cho user khác (others) — đó là lý do nhiều Dockerfile bỏ qua --chown mà
# vẫn hoạt động. Tuy nhiên nếu sau này backend cần GHI file vào các thư mục
# này lúc runtime (vd: ghi log ra file, lưu file tạm...), thiếu --chown sẽ
# gây lỗi "EACCES: permission denied" vì user "nestjs" không có quyền ghi
# lên file do root sở hữu. Nên thêm --chown ngay từ đầu để nhất quán & an
# toàn, tránh phải debug quyền hạn (permission) khi phát sinh nhu cầu ghi
# file về sau.
COPY --from=deps    --chown=nestjs:nodejs /app/node_modules ./node_modules
# Copy code đã build (JavaScript thuần) từ stage "builder"
COPY --from=builder --chown=nestjs:nodejs /app/dist         ./dist
# Copy package.json để Node có thể đọc metadata (version, main entry, ...)
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
# Chứng chỉ CA công khai của AWS (không phải bí mật) — dùng để xác thực
# chuỗi cert RDS khi kết nối SSL.
# Không tự copy được qua "nest build" (không phải file .ts), phải COPY thủ
# công ở đây. Nếu thiếu file này lúc build, lệnh COPY dưới đây sẽ FAIL ngay
# — đó là chủ đích, để phát hiện sớm thay vì để lỗi ẩn tới lúc chạy mới biết.
COPY --from=builder --chown=nestjs:nodejs /app/certs/global-bundle.pem ./certs/global-bundle.pem

# App runtime chỉ chạy bằng "node dist/main", không hề gọi tới "npm"/"npx".
# Xoá hẳn npm CLI (vốn được đóng gói sẵn trong base image node:20-alpine)
# để loại bỏ luôn các CVE tới từ dependency NỘI BỘ của chính npm (tar,
# sigstore, @sigstore/core, ip-address...) — đây không phải dependency của
# app nên không ảnh hưởng gì tới việc chạy app.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Chuyển sang user không phải root trước khi chạy app
USER nestjs

# Khai báo cổng mà container sẽ lắng nghe (chỉ mang tính tài liệu/metadata,
# cần map cổng thật ở docker-compose.yml hoặc "docker run -p")
EXPOSE 3001

# HEALTHCHECK: Docker sẽ tự động gọi định kỳ để kiểm tra app còn sống không.
# - interval: 30s   -> 30 giây kiểm tra 1 lần
# - timeout: 5s     -> chờ tối đa 5s cho mỗi lần kiểm tra
# - start-period:15s-> cho app 15s để khởi động trước khi tính là "unhealthy"
# - retries: 3      -> thử lại 3 lần trước khi đánh dấu container unhealthy
# Dùng "wget --spider" (có sẵn trong alpine/busybox) để chỉ kiểm tra endpoint
# có phản hồi hay không, không cần tải nội dung về.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/api/v1 || exit 1

# ENTRYPOINT dùng dumb-init làm PID 1 để forward signal đúng cách cho tiến
# trình Node.js phía sau (giúp "docker stop" tắt app gọn gàng thay vì bị kill -9).
ENTRYPOINT ["dumb-init", "--"]

# Lệnh chạy chính: khởi động app đã build (tương đương "npm run start:prod")
CMD ["node", "dist/main"]
