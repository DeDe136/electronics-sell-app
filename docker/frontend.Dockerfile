# syntax=docker/dockerfile:1
# ============================================================================
# Dockerfile cho FRONTEND (Next.js 14 - App Router)
#
# Build từ thư mục GỐC của project, vì các lệnh COPY dùng đường dẫn
# "frontend/...". Ví dụ:
#   docker build -f docker/frontend.Dockerfile -t electronics-shop-frontend .
#
# Dockerfile này sử dụng chế độ "output: standalone" của Next.js (đã được
# bật sẵn trong frontend/next.config.js). Chế độ này giúp Next.js tự động
# phân tích và chỉ đóng gói những file/node_modules THỰC SỰ cần thiết để
# chạy server, thay vì phải copy nguyên node_modules (vốn có thể rất nặng).
# => Image production cuối cùng nhỏ gọn hơn rất nhiều.
# ============================================================================


# ── STAGE 1: DEPS ─────────────────────────────────────────────────────────
# Mục đích: cài đặt toàn bộ dependencies (kể cả devDependencies vì Next.js
# cần TypeScript, Tailwind, ESLint... trong lúc build).
FROM node:20-alpine AS deps
WORKDIR /app

# Chỉ copy package.json + package-lock.json trước để tận dụng Docker layer
# cache: nếu chưa đổi dependency, các lần build sau sẽ không cần "npm ci" lại.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci


# ── STAGE 2: BUILDER ─────────────────────────────────────────────────────
# Mục đích: copy source code và build ra bản production ("next build").
FROM node:20-alpine AS builder
WORKDIR /app

# Lấy lại node_modules đã cài ở stage "deps" (tránh phải "npm ci" lại lần nữa)
COPY --from=deps /app/node_modules ./node_modules
# Copy toàn bộ source code frontend (app/, components/, lib/, config...)
COPY frontend/. .

# ARG/ENV NEXT_PUBLIC_API_URL: các biến bắt đầu bằng "NEXT_PUBLIC_" sẽ được
# Next.js NHÚNG THẲNG vào bundle JavaScript phía client NGAY LÚC BUILD
# (không đọc runtime), nên bắt buộc phải truyền vào giai đoạn build này qua
# --build-arg, không thể chỉ set ở docker-compose "environment" của container
# runner là đủ. Có thể override giá trị mặc định bên dưới bằng:
#   docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com ...
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Tắt việc Next.js gửi dữ liệu thống kê sử dụng (telemetry) về Vercel.
ENV NEXT_TELEMETRY_DISABLED=1

# Build production: tạo ra .next/standalone, .next/static nhờ cấu hình
# "output: 'standalone'" trong next.config.js
RUN npm run build


# ── STAGE 3: RUNNER (image chạy thực tế trong production) ───────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Cổng Next.js server sẽ lắng nghe
ENV PORT=3000
# Bind vào 0.0.0.0 để container nhận request từ bên ngoài (không chỉ localhost
# bên trong container) — bắt buộc khi chạy trong Docker.
ENV HOSTNAME=0.0.0.0

# dumb-init: xử lý tín hiệu hệ thống đúng cách (SIGTERM khi "docker stop"),
# tránh app bị kill đột ngột giữa chừng request.
RUN apk add --no-cache dumb-init

# Tạo user riêng không phải root để chạy app (bảo mật tốt hơn)
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Đảm bảo luôn có thư mục /app/public dù project hiện tại chưa có thư mục
# "public" nào (next.config.js standalone output vẫn mong đợi copy public/,
# nếu thiếu thư mục này COPY phía dưới sẽ lỗi ở một số version Docker).
RUN mkdir -p /app/public

# Copy các file tĩnh (ảnh, favicon, ...) nếu có
COPY --from=builder /app/public ./public

# Copy server đã build ở chế độ "standalone" — bao gồm server.js và
# node_modules TỐI THIỂU cần thiết (đã được Next.js tự động trace/prune).
# --chown=nextjs:nodejs: đổi quyền sở hữu file ngay lúc copy, để user
# "nextjs" (không phải root) có thể đọc/ghi khi cần.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy riêng thư mục static assets (JS/CSS đã build) — KHÔNG nằm trong
# "standalone" nên phải copy thêm bước này theo đúng tài liệu chính thức
# của Next.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Chuyển sang user không phải root trước khi chạy app
USER nextjs

EXPOSE 3000

# HEALTHCHECK: Docker định kỳ gọi trang chủ ("/") để kiểm tra server còn
# phản hồi hay không. Xem giải thích chi tiết các tham số trong
# backend.Dockerfile (interval/timeout/start-period/retries).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000 || exit 1

# Dùng dumb-init làm PID 1 để forward signal đúng cách cho tiến trình Node.js
ENTRYPOINT ["dumb-init", "--"]

# server.js là file entrypoint được Next.js tự sinh ra khi dùng
# "output: standalone" (tương đương lệnh "next start" nhưng gọn nhẹ hơn).
CMD ["node", "server.js"]
