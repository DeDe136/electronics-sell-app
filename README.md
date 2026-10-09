# 🛍️ TechShop — Electronics E-Commerce

![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?style=flat&logo=nodedotjs&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E?style=flat&logo=nestjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=nextdotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-latest-C72E49?style=flat&logo=minio&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-4.x-433E38?style=flat&logo=react&logoColor=white)

> **Modular Monolith** — dễ tách thành Microservices khi cần scale.  
> *Ứng dụng thương mại điện tử bán đồ điện tử, đánh giá trên WSL2 Ubuntu 22.04*
>
> Có 4 cách chạy/triển khai project: cài **native** từng service theo hướng dẫn ở mục 4–6 bên dưới;
> chạy **toàn bộ stack qua Docker Compose** (`docker compose -f docker/docker-compose.yml up -d --build`);
> chạy trên **K3s + Helm** ở máy local; hoặc triển khai lên **AWS EKS** (thủ công hoặc bằng Terraform).

---

## 📋 Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Mô tả từng module Backend](#2-mô-tả-từng-module-backend)
3. [Mô tả Frontend](#3-mô-tả-frontend)
4. [Yêu cầu hệ thống](#4-yêu-cầu-hệ-thống)
5. [Cài đặt môi trường](#5-cài-đặt-môi-trường)
6. [Hướng dẫn chạy local](#6-hướng-dẫn-chạy-local)
7. [API Reference](#7-api-reference)
8. [Biến môi trường](#8-biến-môi-trường)
9. [DevSecOps](#9-devsecops)
10. [Hướng dẫn khởi tạo CI-CD pipeline](#10-hướng-dẫn-khởi-tạo-ci-cd-pipeline)
11. [Lộ trình tách Microservices](#11-lộ-trình-tách-microservices)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Tổng quan kiến trúc

```
Browser (Next.js 15 App Router)
        │  HTTP / REST
        ▼
NestJS API  ──►  PostgreSQL  (TypeORM; local/Compose: 16, AWS RDS: 18)
        │
        └──────►  MinIO (local) / AWS S3 ở EKS  (ảnh sản phẩm, avatar)
```

Khi triển khai lên **AWS EKS**, luồng chạy thật như sau:

```
Người dùng ─► DNS (dynv6) ─► NLB (giải mã TLS bằng chứng chỉ ACM)
                                    │
                                    ▼
                    Traefik  (IngressRoute / TraefikService — chia % traffic canary)
                      │                                   │
                      ▼                                   ▼
        frontend (Argo Rollout, Next.js)        backend (Argo Rollout, NestJS)
                      │ /api/images/*                     │
                      ▼                                   ├─► RDS PostgreSQL 18 Multi-AZ
              S3 (bucket private,                         │     (mật khẩu ở Secrets Manager, lấy qua IRSA)
               đọc qua IRSA)                              └─► S3 (upload/xóa ảnh, qua IRSA)
```

Phần vận hành đi kèm (không nằm trong luồng request): **Harbor** (registry chứa image), **Argo CD** (GitOps đồng bộ
Helm chart), **Argo Rollouts** (canary), **KEDA** (autoscaling), **kube-prometheus-stack** (Prometheus + Grafana +
Alertmanager), **GitHub Actions** (CI/CD, Terraform). Sơ đồ hạ tầng AWS:

![AWS Architecture](docs/diagrams/AWS%20Architecture/AWS%20Architecture.png)

**Modular Monolith** nghĩa là:
- Mỗi business domain (`auth`, `catalog`, `cart`...) là một **NestJS Module hoàn toàn độc lập** — có controller, service, entity, DTO riêng.
- Các module chỉ giao tiếp qua **Service injection** (không gọi thẳng DB của nhau).
- Khi cần tách Microservice: copy module ra repo riêng, thay Service injection bằng HTTP/gRPC/message queue — **không cần rewrite logic**.

### Các port mặc định

| Service        | Port  | URL                              |
|----------------|-------|----------------------------------|
| Frontend       | 3000  | http://localhost:3000            |
| Backend API    | 3001  | http://localhost:3001/api/v1     |
| Swagger Docs   | 3001  | http://localhost:3001/api/docs   |
| MinIO API      | 9000  | http://localhost:9000            |
| MinIO Console  | 9001  | http://localhost:9001            |
| PostgreSQL     | 5432  | localhost:5432                   |
| Backend metrics | 3001 | http://localhost:3001/metrics (ngoài prefix `api/v1`) |

---

## 2. Mô tả từng module Backend

### 🔐 Auth Module
Xử lý đăng ký, đăng nhập và cấp JWT token.

| Endpoint | Method | Mô tả |
|---|---|---|
| `/api/v1/auth/register` | POST | Đăng ký, trả về `{ accessToken, user }` |
| `/api/v1/auth/login` | POST | Đăng nhập, trả về `{ accessToken, user }` |

Password được hash bằng **bcryptjs** (12 rounds). Token JWT có thời hạn 7 ngày (cấu hình qua `JWT_EXPIRES_IN`).

### 👤 User Module
Quản lý thông tin cá nhân + quản trị người dùng (Admin).

| Endpoint | Method | Auth | Mô tả |
|---|---|---|---|
| `/api/v1/users/me` | GET | ✅ | Lấy profile hiện tại |
| `/api/v1/users/me` | PATCH | ✅ | Cập nhật fullName, phone, address |
| `/api/v1/users/me/avatar` | PATCH | ✅ | Upload avatar (multipart/form-data) |
| `/api/v1/users/me` | DELETE | ✅ | Tự xóa tài khoản (chặn nếu còn đơn hàng chưa hoàn thành) |
| `/api/v1/users/admin/all` | GET | 🔑 Admin | Danh sách toàn bộ người dùng |
| `/api/v1/users/admin/:id` | GET | 🔑 Admin | Chi tiết một người dùng |
| `/api/v1/users/admin/:id` | PATCH | 🔑 Admin | Cập nhật thông tin, đổi role, khóa/mở khóa tài khoản |
| `/api/v1/users/admin/:id` | DELETE | 🔑 Admin | Xóa một người dùng |

### 📦 Catalog Module
Quản lý sản phẩm điện tử với **specs linh hoạt dạng JSONB**.

**Thiết kế đặc biệt cho đồ điện tử:**
- Field `specs` lưu `JSONB` — query được trực tiếp: `WHERE specs->>'ram' = '16GB'`
- Field `variants` lưu array biến thể (màu sắc, cấu hình, giá riêng)
- Field `images` lưu `[{ url, key }]` — `key` để xóa file trên S3/MinIO khi cần

| Endpoint | Method | Auth | Mô tả |
|---|---|---|---|
| `/api/v1/catalog/categories` | GET | ❌ | Danh sách danh mục |
| `/api/v1/catalog/products` | GET | ❌ | List sản phẩm với filter & pagination |
| `/api/v1/catalog/products/:slug` | GET | ❌ | Chi tiết sản phẩm (tăng viewCount) |
| `/api/v1/catalog/products` | POST | 🔑 Admin | Tạo sản phẩm + upload ảnh (multipart) |
| `/api/v1/catalog/products/:id` | PATCH | 🔑 Admin | Cập nhật sản phẩm |
| `/api/v1/catalog/products/:id` | DELETE | 🔑 Admin | Xóa sản phẩm + xóa ảnh khỏi S3 |
| `/api/v1/catalog/categories/:id` | GET/POST/PATCH/DELETE | ❌ / 🔑 Admin | CRUD danh mục |
| `/api/v1/catalog/products/:id/variants` | GET | ❌ | Danh sách variants của sản phẩm |
| `/api/v1/catalog/variants/:variantId` | GET | ❌ | Chi tiết một variant |
| `/api/v1/catalog/products/:id/variants` | POST | 🔑 Admin | Thêm variant cho sản phẩm |
| `/api/v1/catalog/variants/:variantId` | PATCH/DELETE | 🔑 Admin | Sửa / xóa variant |

### 🛒 Cart Module
Giỏ hàng lưu trong DB (không dùng localStorage/session) — hỗ trợ đăng nhập nhiều thiết bị.

- Thêm item đã có trong giỏ → **tự động tăng quantity** (merge)
- `getCart()` trả về `{ items, subtotal, itemCount }` — subtotal tính theo `salePrice` nếu có
- Có thể xóa từng item (`DELETE /cart/items/:id`), xóa nhiều item cùng lúc theo danh sách id
  (`DELETE /cart/items` với body `{ itemIds: [...] }` — dùng sau khi đặt hàng thành công),
  hoặc xóa sạch giỏ (`DELETE /cart`)

### 📋 Order Module
Hỗ trợ 2 luồng đặt hàng:
- **Từ giỏ hàng** (`POST /orders`) — người dùng chọn các item muốn đặt (`items: [{ cartItemId, quantity }]`,
  có thể chỉ đặt một phần số lượng trong giỏ), chạy trong **database transaction**:
  1. Tạo `Order` record với mã đơn hàng tự sinh (phí vận chuyển cố định 30.000đ)
  2. Snapshot từng `OrderItem` (tên SP, ảnh, nhãn variant, đơn giá tại thời điểm đặt)
  3. Tạo `Payment` theo phương thức đã chọn (COD → `success` ngay, các phương thức khác → `pending`)
  4. Cập nhật giỏ hàng: đặt hết số lượng thì xóa item, đặt một phần thì giảm số lượng còn lại
  5. Rollback toàn bộ nếu bất kỳ bước nào lỗi
- **Mua ngay** (`POST /orders/buy-now`) — `items: [{ productId, variantId?, quantity }]`, tạo đơn trực tiếp từ
  sản phẩm/variant, không cần qua giỏ hàng

Khách hàng chỉ tự hủy được đơn khi đang ở trạng thái `pending` (`PATCH /orders/:id/cancel`). Admin quản lý toàn bộ
đơn hàng qua `GET /orders/admin/all`, cập nhật trạng thái qua `PATCH /orders/admin/:id/status`, và chỉ xóa được
đơn đã `cancelled` hoặc `refunded` (`DELETE /orders/admin/:id`).

`status` của đơn hàng: `pending` → `confirmed` → `shipping` → `delivered`, hoặc `cancelled` /
`refunded`.

### 💳 Payment Module
Danh sách phương thức thanh toán được cấu hình động trong bảng `payment_method_options`
(không hard-code ở frontend), lấy qua `GET /payments/methods`:
- **COD** (`cod`): tự confirm ngay khi tạo
- **Chuyển khoản ngân hàng** (`bank_transfer`)
- **MoMo** (`momo`) / **VNPay** (`vnpay`): có webhook `POST /payments/webhook/vnpay` nhận
  callback xác nhận thanh toán

Admin có thể cập nhật trạng thái giao dịch (`PATCH /payments/admin/:id/status`) hoặc xóa giao
dịch (`DELETE /payments/admin/:id`).

### 📊 Inventory Module
Quản lý tồn kho theo **SKU** (`productId` hoặc `productId-variantId`).
- `quantity`: tổng số lượng trong kho
- `reserved`: đang giữ cho đơn chưa xử lý
- **Available = quantity − reserved**
- `lowStockThreshold`: ngưỡng cảnh báo hàng sắp hết

### 🗄️ Storage Service (Shared)
Dùng **AWS SDK v3** — hỗ trợ cả AWS S3 và MinIO (switch qua biến `STORAGE_PROVIDER`).

```
uploadFile(file, folder)            → { key, url, bucket }
uploadFiles(files, folder)          → UploadResult[]
deleteFile(key)                     → void
getPresignedUploadUrl(key, type)    → string  (client upload trực tiếp lên S3/MinIO)
getSignedReadUrl(key)               → string  (truy cập file private có TTL)
```

- **MinIO** (`STORAGE_PROVIDER=minio`): `url` là URL tuyệt đối `<MINIO_ENDPOINT>/<bucket>/<key>` (bucket đặt
  quyền anonymous download).
- **AWS S3** (mọi giá trị khác): bucket **private** (Block Public Access bật), `url` trả về là path nội bộ
  `/api/images/<key>` — frontend đọc S3 hộ trình duyệt. Trên EKS **không** truyền access key: SDK tự
  lấy credentials tạm thời qua **IRSA**.

### ❤️ Health Controller (Shared)
`GET /api/v1/health` — health check đơn giản, trả về `{ status: 'ok', timestamp, version }`. Không cần
đăng nhập. Dùng bởi route `frontend/app/api/health-check/route.ts` và readiness/liveness probe của backend trên
Kubernetes (Helm chart).

### 📈 Metrics Module (Shared)
`GET /metrics` (nằm **ngoài** prefix `api/v1`, ẩn khỏi Swagger) trả về metrics định dạng Prometheus bằng `prom-client`:
- Metric mặc định của Node.js (heap, event loop lag, GC, file descriptor...).
- 2 metric HTTP do `HttpMetricsInterceptor` tự ghi cho mọi request: `http_request_duration_seconds` (histogram) và
  `http_requests_total` (counter), label `method`, `route`, `status_code`. Label `route` dùng **pattern**
  (`/catalog/products/:id`) thay vì URL thật để số time-series không tăng vô hạn theo số bản ghi.
- Mọi metric đều có label `app="backend"`. Prometheus thu thập qua PodMonitor (xem mục 10, bước 6).

### ⚙️ Cấu hình dùng chung (DB credentials, upload)
- **Database:** mặc định đọc `DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME`. Khi `DB_CREDENTIALS_SOURCE=secrets-manager`
  (dùng trên EKS), backend lấy username/password từ secret master của RDS qua `DB_SECRET_ARN`
  (`config/secrets-manager.ts`, credentials AWS lấy qua IRSA) và kết nối SSL, xác thực bằng CA bundle
  `backend/certs/global-bundle.pem`.
- **Schema:** TypeORM chỉ tự `synchronize` (tạo/cập nhật bảng) khi `NODE_ENV !== 'production'`. `scripts/migrate.sh`
  vẫn là placeholder (chưa có migration thật), nên khi chạy với `NODE_ENV=production` cần tự đảm bảo schema đã tồn tại.
- **Upload ảnh** (avatar, ảnh sản phẩm): tối đa 5MB, chỉ nhận `jpg/jpeg/png/webp`
  (`common/constants/upload.constants.ts`); mỗi lần tạo/sửa sản phẩm nhận tối đa 10 ảnh.

---

## 3. Mô tả Frontend

### Trang Home (`/`)
- **SSR** — fetch dữ liệu server-side, SEO-friendly
- Banner hero 3 cột responsive
- Category pills (cập nhật URL param, không reload trang)
- Sidebar filter: khoảng giá, thương hiệu
- Product grid: 2 cột mobile → 4 cột desktop
- Sort dropdown, pagination

### Trang Login (`/login`)
- Form toggle đăng nhập / đăng ký trên cùng trang
- Validate client-side trước khi gọi API
- Lưu `accessToken` vào `localStorage`, tự redirect về trang chủ sau khi thành công

### Trang Product Detail (`/products/[slug]`)
- **Client Component** — fetch khi mount
- Gallery ảnh với thumbnails, chuyển prev/next
- Chọn variant (màu/cấu hình) → giá cập nhật tức thì
- Quantity stepper
- Bảng thông số `ProductSpecs` với label tiếng Việt tự động
- **Add to Cart** → Zustand store cập nhật badge trên Navbar
- **Mua ngay** → lưu thông tin sản phẩm/variant/số lượng vào `sessionStorage` rồi chuyển
  sang `/buy-now`, bỏ qua bước thêm vào giỏ hàng

### Trang Cart (`/cart`)
- Zustand store đồng bộ với server qua `fetchCart()`
- Chỉnh quantity inline, xóa từng item
- Order summary: subtotal + phí vận chuyển
- Chọn item muốn mua → lưu vào `sessionStorage` → chuyển sang `/checkout` để nhập địa chỉ
  và chọn phương thức thanh toán

### Trang Checkout (`/checkout`)
- Đọc danh sách item đã chọn từ `sessionStorage` (do trang Cart ghi vào)
- Form địa chỉ giao hàng (họ tên, SĐT, địa chỉ, phường/xã, quận/huyện, tỉnh/thành)
- Chọn phương thức thanh toán — lấy danh sách động từ `GET /payments/methods`
- Tạo đơn qua `POST /orders`, sau đó chuyển sang `/order-success?orderCode=...`

### Trang Buy Now (`/buy-now`)
- Tương tự Checkout nhưng dùng cho luồng "Mua ngay" 1 sản phẩm — đọc item từ
  `sessionStorage` (do trang chi tiết sản phẩm ghi vào), tạo đơn qua `POST /orders/buy-now`

### Trang Order Success (`/order-success`)
- Trang xác nhận đặt hàng thành công, hiển thị mã đơn hàng (`orderCode`) lấy từ query string,
  kèm nút quay về trang chủ / xem đơn hàng trong Profile

### Trang Profile (`/profile`)
- Tab "Thông tin cá nhân" và "Lịch sử đơn hàng"
- Sửa form inline, lưu qua API `PATCH /users/me`
- Upload avatar trực tiếp
- Danh sách đơn hàng với badge màu theo trạng thái
- Nút đăng xuất (xóa token khỏi localStorage)

### Route handler phía server (`app/api/*`)

| Route | Mô tả |
|---|---|
| `/api/health-check` | Gọi `GET /health` của backend (qua `INTERNAL_API_URL`) để kiểm tra kết nối |
| `/api/ping` | Trả `{ status: 'ok' }` — dùng làm readiness/liveness probe của Pod frontend, **không** gọi backend nên không tạo traffic giả |
| `/api/metrics` | Metrics Prometheus của frontend (`prom-client`) |
| `/api/images/[...key]` | Proxy đọc ảnh từ **S3 private** bằng AWS SDK (credentials qua IRSA). Chỉ được gọi khi backend chạy với `STORAGE_PROVIDER` khác `minio` |

Các request `/api/*` còn lại được `next.config.js` rewrite sang backend. Ảnh có URL dạng `/api/images/...`
được render với `unoptimized` (`lib/image.ts`), vì Next Image Optimizer sẽ phải tự gọi lại chính nó qua load
balancer trên EKS và bị lỗi.

### Observability (metrics)
- `instrumentation.ts` chạy 1 lần lúc server khởi động: khởi tạo registry `prom-client` và đăng ký OpenTelemetry
  (`@vercel/otel`) để đo thời gian render trang SSR.
- `lib/with-metrics.ts` bọc các route handler để đo duration + đếm request, dùng chung tên metric với backend
  (`http_request_duration_seconds`, `http_requests_total`), khác nhau ở label `app="frontend"`.

---

## 4. Yêu cầu hệ thống

| Công cụ | Phiên bản tối thiểu | Ghi chú |
|---|---|---|
| Node.js | 20 LTS | Dùng nvm để quản lý version |
| npm | 10+ | Đi kèm Node.js 20 |
| PostgreSQL | 16 | Chạy native hoặc Docker (RDS trên AWS dùng bản 18) |
| MinIO | Latest | Chạy native (hướng dẫn bên dưới) |
| Git | 2.x | |
| Docker + Docker Compose | Mới nhất | *Tùy chọn* — chạy stack bằng Compose, build image (mục 10, bước 1) |
| kubectl, Helm, K3s | Mới nhất | *Tùy chọn* — chạy trên Kubernetes local (mục 10, bước 3–7) |
| AWS CLI, Terraform | Terraform ≥ 1.10 | *Tùy chọn* — triển khai lên AWS EKS (mục 10, bước 8–10) |

> **WSL2 (Windows):** Hướng dẫn này được viết và kiểm tra trên **WSL2 Ubuntu 22.04**. Tất cả lệnh dùng trong terminal WSL2. Không dùng PowerShell hay CMD.

---

## 5. Cài đặt môi trường

### 5.1 — Node.js 20 LTS (qua nvm)

```bash
# Cài nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Reload shell
source ~/.bashrc   # hoặc ~/.zshrc nếu dùng zsh

# Cài và dùng Node 20
nvm install 20
nvm use 20
nvm alias default 20

# Kiểm tra
node -v   # → v20.x.x
npm -v    # → 10.x.x
```

### 5.2 — PostgreSQL 16

**Cài đặt (Ubuntu / WSL2):**
```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
```

**Tạo database:**
```bash
# Khởi động PostgreSQL lần đầu
sudo service postgresql start

# Tạo database
sudo -u postgres psql -c "CREATE DATABASE electronics_shop;"

# Kiểm tra đã tạo thành công
sudo -u postgres psql -c "\l" | grep electronics_shop
```

> **Lưu ý WSL2:** Không dùng `psql -U postgres` trực tiếp vì sẽ báo lỗi `peer authentication failed`. Phải dùng `sudo -u postgres psql` để chạy với đúng OS user.

**Đổi password postgres (nếu cần):**
```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

#### 🔄 Quản lý vòng đời PostgreSQL (tắt / bật)

WSL2 không có `systemd` theo mặc định nên PostgreSQL **không tự chạy** khi mở terminal mới, và **không tự dừng** khi đóng terminal. Dưới đây là cách quản lý đúng:

**Khởi động thủ công:**
```bash
sudo service postgresql start
```

**Dừng thủ công (khi thoát project):**
```bash
sudo service postgresql stop
```

**Khởi động lại (sau khi thay đổi config):**
```bash
sudo service postgresql restart
```

**Kiểm tra trạng thái:**
```bash
sudo service postgresql status
```

---

**Tự động khởi động khi mở terminal (tuỳ chọn):**

Thêm vào cuối `~/.bashrc` để PostgreSQL tự start mỗi khi mở terminal WSL2:

```bash
echo 'sudo service postgresql start > /dev/null 2>&1' >> ~/.bashrc
source ~/.bashrc
```

> **Lưu ý:** Cách này yêu cầu password sudo mỗi lần. Để bỏ yêu cầu password cho lệnh này, thêm vào `/etc/sudoers`:
> ```bash
> sudo visudo
> # Thêm dòng sau (thay <username> bằng tên user của bạn):
> <username> ALL=(ALL) NOPASSWD: /usr/sbin/service postgresql start, /usr/sbin/service postgresql stop, /usr/sbin/service postgresql restart
> ```

---

**Tự động dừng khi đóng terminal (tuỳ chọn):**

Thêm vào cuối `~/.bashrc` để PostgreSQL tự stop khi shell thoát:

```bash
echo 'trap "sudo service postgresql stop > /dev/null 2>&1" EXIT' >> ~/.bashrc
source ~/.bashrc
```

> **Cảnh báo:** `trap EXIT` sẽ dừng PostgreSQL ngay khi terminal đóng lại — kể cả khi backend vẫn đang chạy ở tab khác. Chỉ dùng nếu bạn chạy tất cả services trong cùng một terminal session.

---

**Tự động tắt và bật theo project (khuyến nghị):**

Thay vì dùng `trap`, hãy ghi hai alias vào `~/.bashrc` để tồn tại vĩnh viễn qua các phiên:

```bash
# Ghi alias vào ~/.bashrc (chỉ cần chạy một lần duy nhất)
echo 'alias db-start="sudo service postgresql start && echo \"✅ PostgreSQL started\""' >> ~/.bashrc
echo 'alias db-stop="sudo service postgresql stop && echo \"🛑 PostgreSQL stopped\""' >> ~/.bashrc

# Áp dụng ngay cho phiên hiện tại
source ~/.bashrc
```

Từ lần sau chỉ cần:

```bash
# Khi bắt đầu làm việc
db-start

# Khi kết thúc làm việc
db-stop
```

Đây là cách **được khuyến nghị nhất** — kiểm soát rõ ràng, không có tác dụng phụ.

---

### 5.3 — MinIO (Object Storage)

**Tải và cài MinIO server:**
```bash
# Tải binary
wget https://dl.min.io/server/minio/release/linux-amd64/minio -O ~/minio
chmod +x ~/minio

# Tạo thư mục lưu data
mkdir -p ~/minio-data

# Chạy MinIO server
~/minio server ~/minio-data --console-address ":9001"

# Tạo alias để tiện cho mỗi lần chạy (tùy chọn)
echo 'alias minio-server="~/minio server ~/minio-data --console-address :9001"' >> ~/.bashrc
source ~/.bashrc

# Chạy MinIO server từ alias đã tạo
minio-server
```

MinIO sẽ in ra thông tin:
```
API: http://localhost:9000
Console: http://localhost:9001
RootUser: minioadmin
RootPass: minioadmin
```

**Cài MinIO Client (`mc`) để quản lý bucket:**
```bash
# Tải mc binary
wget https://dl.min.io/client/mc/release/linux-amd64/mc -O ~/mc
chmod +x ~/mc

# Thêm vào PATH (thêm vào ~/.bashrc)
echo 'export PATH="$HOME:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Hoặc dùng trực tiếp bằng ~/mc
```

**Tạo bucket và set public access:**
```bash
# Đăng ký MinIO server với mc (đặt alias là "local")
mc alias set local http://localhost:9000 minioadmin minioadmin

# Tạo bucket
mc mb local/electronics-shop

# Set policy public (cho phép đọc ảnh không cần auth)
mc anonymous set public local/electronics-shop

# Kiểm tra
mc ls local/
mc anonymous get local/electronics-shop
```

> **Lưu ý:** MinIO Console web UI (http://localhost:9001) hiện tại không hỗ trợ thao tác đặt bucket policy trực tiếp. Phải dùng `mc` CLI như hướng dẫn trên.

**Upload ảnh khớp đúng key trong seed**

Mở `backend/src/database/seeds/product.seed.ts`, đối chiếu từng `key` (ví
dụ `products/iphone17promax/1.jpg`) → **MinIO Console → bucket
`electronics-shop` → Upload** → tạo đúng cấu trúc thư mục/tên file khớp
chính xác từng key đó.

Hoặc, download các ảnh mẫu có sẵn từ Google Drive có đường dẫn được đặt tại `docs/image-assets.txt`, rồi upload lên bucket `electronics-shop` tại MinIO Console.

**Chạy MinIO ở background (tuỳ chọn):**
```bash
# Chạy background với nohup
nohup ~/minio server ~/minio-data --console-address ":9001" > ~/minio.log 2>&1 &

# Kiểm tra đang chạy
ps aux | grep minio

# Dừng MinIO
pkill minio
```

### 5.4 — Git

```bash
# Ubuntu / WSL2
sudo apt install -y git

# Cấu hình cơ bản
git config --global user.name "Tên của bạn"
git config --global user.email "email@example.com"
```

---

## 6. Hướng dẫn chạy local

### Bước 1 — Clone project

```bash
git clone <repo-url> electronics-shop
cd electronics-shop
```

### Bước 2 — Cấu hình Backend

```bash
cd backend

# Tạo file .env từ template
cp .env.example .env
```

Mở `backend/.env` và chỉnh sửa theo môi trường của bạn:

```env
# App
PORT=3001
NODE_ENV=development

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=electronics_shop

# Seed database (PostgreSQL) — chỉ dùng khi chạy seed, không dùng trong production
SEED_DB_HOST=localhost
SEED_MEDIA_BASE_URL=http://localhost:9000/electronics-shop

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Storage — chọn 1 trong 2 provider
STORAGE_PROVIDER=minio   # 'minio' | 's3'

# AWS S3 (nếu dùng S3)
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=electronics-shop

# MinIO (nếu chạy local)
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=electronics-shop

# CORS — URL frontend
FRONTEND_URL=http://localhost:3000
```

```bash
# Cài dependencies
npm install

# Chạy dev server (hot reload)
npm run start:dev
```

✅ Backend sẽ chạy tại **http://localhost:3001**  
✅ Swagger docs tại **http://localhost:3001/api/docs**  
✅ TypeORM tự động `synchronize` (tạo/cập nhật tables) khi `NODE_ENV=development`

### Bước 3 — Cấu hình Frontend

Mở terminal mới:

```bash
cd frontend

# Tạo file .env.local
cp .env.local.example .env.local
```

File `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

```bash
# Cài dependencies
npm install

# Chạy dev server
npm run dev
```

✅ Frontend sẽ chạy tại **http://localhost:3000**

### Bước 4 — Thứ tự khởi động (quan trọng)

```
1. PostgreSQL   → sudo service postgresql start
2. MinIO        → ~/minio server ~/minio-data --console-address ":9001"
3. Backend      → cd backend && npm run start:dev
4. Frontend     → cd frontend && npm run dev
```

### Bước 5 — Seed dữ liệu mẫu

Project có sẵn bộ seed dữ liệu đầy đủ, chạy theo thứ tự phụ thuộc:
`categories → products → variants → inventory → users → orders → cart_items`

```bash
# Chạy từ thư mục root của project
bash scripts/seed.sh

# Hoặc chạy trực tiếp từ thư mục backend
cd backend
npx ts-node src/database/seeds/run-seeds.ts
```

> **Lưu ý:** Backend phải đã chạy ít nhất một lần để TypeORM tạo đủ các bảng trước khi seed.

### Bước 6 — Tạo tài khoản admin đầu tiên

```bash
# 1. Đăng ký tài khoản thường
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@techshop.vn","password":"Admin@1234","fullName":"Admin"}'

# 2. Đổi role thành admin trực tiếp trong DB
sudo -u postgres psql -d electronics_shop \
  -c "UPDATE users SET role='admin' WHERE email='admin@techshop.vn';"

# Kiểm tra
sudo -u postgres psql -d electronics_shop \
  -c "SELECT email, role FROM users WHERE email='admin@techshop.vn';"
```

> **Hoặc dùng tài khoản từ seed:** Nếu đã chạy seed, tài khoản admin đã được tạo sẵn — xem file `backend/src/database/seeds/user.seed.ts` để biết thông tin đăng nhập.

### Kiểm tra tổng thể

| Service | URL | Mô tả |
|---|---|---|
| Frontend | http://localhost:3000 | Trang chủ shop |
| Backend API | http://localhost:3001/api/v1 | REST API |
| Swagger | http://localhost:3001/api/docs | API docs interactive (chỉ development) |
| MinIO Console | http://localhost:9001 | Quản lý file/bucket (login: minioadmin/minioadmin) |

---

## 7. API Reference

### Auth

```http
POST /api/v1/auth/register
Content-Type: application/json

{ "email": "user@example.com", "password": "Pass@1234", "fullName": "Nguyen Van A" }
```

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "Pass@1234" }
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": "uuid", "email": "...", "fullName": "...", "role": "user" }
}
```

### Catalog — Ví dụ filter sản phẩm

```http
# Lọc điện thoại Apple giá 15-25 triệu, sắp xếp rẻ nhất
GET /api/v1/catalog/products?brand=Apple&minPrice=15000000&maxPrice=25000000&sort=price_asc

# Tìm kiếm MacBook, lấy 10 kết quả phổ biến nhất
GET /api/v1/catalog/products?search=macbook&sort=popular&limit=10&page=1

# Lọc theo specs (RAM 16GB)
GET /api/v1/catalog/products?specs[ram]=16GB&sort=newest
```

### Catalog — Tạo sản phẩm (multipart/form-data)

```http
POST /api/v1/catalog/products
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data

name: "Samsung Galaxy S24 Ultra"
brand: "Samsung"
price: 29990000
salePrice: 27990000
categoryId: "<category-uuid>"
specs: {"ram":"12GB","storage":"256GB","battery":"5000mAh","screen":"6.8\" QHD+","chipset":"Snapdragon 8 Gen 3","camera":"200MP","os":"Android 14"}
images: [file1.jpg, file2.jpg]
```

### Cart

```http
GET    /api/v1/cart                   # Lấy giỏ hàng hiện tại
POST   /api/v1/cart/items             # Thêm: { "productId": "uuid", "quantity": 1, "variantId": "uuid" }
PATCH  /api/v1/cart/items/:id        # Cập nhật số lượng: { "quantity": 2 }
DELETE /api/v1/cart/items/:id        # Xóa 1 item
DELETE /api/v1/cart/items            # Xóa nhiều item: { "itemIds": ["uuid-1", "uuid-2"] }
DELETE /api/v1/cart                   # Xóa toàn bộ giỏ hàng
```

### Payments — Lấy danh sách phương thức thanh toán

```http
GET /api/v1/payments/methods
```

### Order

```http
POST /api/v1/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "shippingAddress": {
    "fullName": "Nguyen Van A",
    "phone": "0901234567",
    "address": "123 Nguyen Hue",
    "ward": "Ben Nghe",
    "district": "Quan 1",
    "city": "TP Ho Chi Minh"
  },
  "items": [{ "cartItemId": "uuid", "quantity": 1 }],
  "paymentMethod": "cod",
  "note": "Giao giờ hành chính"
}
```

```http
GET   /api/v1/orders             # Lấy danh sách đơn hàng của tôi
GET   /api/v1/orders/:id         # Chi tiết 1 đơn hàng
PATCH /api/v1/orders/:id/cancel  # Tự hủy đơn hàng
```

### Order — Mua ngay (bỏ qua giỏ hàng)

```http
POST /api/v1/orders/buy-now
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [{ "productId": "uuid", "variantId": "uuid", "quantity": 1 }],
  "shippingAddress": { "...": "giống POST /orders" },
  "paymentMethod": "cod"
}
```

### Order / Payment — Quản trị (Admin)

```http
GET    /api/v1/orders/admin/all           # Danh sách toàn bộ đơn hàng
PATCH  /api/v1/orders/admin/:id/status    # Cập nhật trạng thái đơn hàng
DELETE /api/v1/orders/admin/:id           # Xóa đơn hàng
PATCH  /api/v1/payments/admin/:id/status  # Cập nhật trạng thái giao dịch
DELETE /api/v1/payments/admin/:id         # Xóa giao dịch thanh toán
```

### Inventory (Admin)

```http
GET /api/v1/inventory/:productId     # Xem tồn kho
PUT /api/v1/inventory/:productId     # Cập nhật: { "quantity": 100, "lowStockThreshold": 10 }
```

### Health check

```http
GET /api/v1/health     # → { "status": "ok", "timestamp": "...", "version": "..." } — không cần đăng nhập
```

---

## 8. Biến môi trường

### Backend (`backend/.env`)

| Biến | Mặc định | Bắt buộc | Mô tả |
|---|---|---|---|
| `PORT` | `3001` | | Port chạy NestJS |
| `NODE_ENV` | `development` | | `development` / `production` |
| `ENABLE_SWAGGER` | — | | Set `'true'` để ép bật Swagger dù `NODE_ENV=production` (dùng khi test qua Docker Compose). Mặc định: chỉ bật khi `NODE_ENV !== 'production'` |
| `FRONTEND_URL` | `http://localhost:3000` | | URL frontend cho CORS |
| `DB_HOST` | `localhost` | ✅ | PostgreSQL host |
| `DB_PORT` | `5432` | | PostgreSQL port |
| `DB_USERNAME` | `postgres` | ✅ | PostgreSQL username |
| `DB_PASSWORD` | `postgres` | ✅ | PostgreSQL password |
| `DB_NAME` | `electronics_shop` | ✅ | Tên database |
| `SEED_DB_HOST` | `localhost` | | Host PostgreSQL dùng riêng khi chạy script seed (`run-seeds.ts`) |
| `SEED_MEDIA_BASE_URL` | `http://localhost:9000/electronics-shop` | | Base URL gắn vào ảnh sản phẩm khi seed; đổi thành `http://minio:9000/electronics-shop` nếu seed trong môi trường Docker Compose |
| `JWT_SECRET` | — | ✅ | Secret key ký JWT (tối thiểu 32 ký tự) |
| `JWT_EXPIRES_IN` | `7d` | | Thời hạn token (7d, 24h, ...) |
| `STORAGE_PROVIDER` | `minio` | ✅ | `minio` hoặc `s3` |
| `MINIO_ENDPOINT` | `http://localhost:9000` | | MinIO server URL |
| `MINIO_ACCESS_KEY` | `minioadmin` | | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin` | | MinIO secret key |
| `MINIO_BUCKET` | `electronics-shop` | | Tên bucket MinIO |
| `AWS_REGION` | `ap-southeast-1` | | AWS region (khi dùng S3) |
| `AWS_ACCESS_KEY_ID` | — | | AWS access key (khi dùng S3) |
| `AWS_SECRET_ACCESS_KEY` | — | | AWS secret key (khi dùng S3) |
| `AWS_S3_BUCKET` | `electronics-shop` | | Tên S3 bucket (khi dùng S3) |

### Frontend (`frontend/.env.local`)

| Biến | Mặc định | Mô tả |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` | URL backend API — nhúng vào bundle JS phía trình duyệt lúc build |
| `INTERNAL_API_URL` | — (fallback về `NEXT_PUBLIC_API_URL`) | URL backend dùng bởi code chạy **server-side bên trong container frontend** (route `api/health-check`, `next.config.js` rewrites). Trong Docker Compose set = `http://backend:3001/api/v1`. Không có tiền tố `NEXT_PUBLIC_` nên không bị lộ ra client bundle |

---

## 9. DevSecOps

Toàn bộ pipeline chạy bằng GitHub Actions (`.github/workflows/`). Cách dựng pipeline từng bước từ đầu xem
[mục 10](#10-hướng-dẫn-khởi-tạo-ci-cd-pipeline).

### GitHub Actions workflows

| Workflow | Trạng thái | Kích hoạt | Mô tả |
|---|---|---|---|
| `.github/workflows/ci.yml` | ✅ Hoàn chỉnh | push/PR vào `main`, `thanhde`; lịch thứ 2 hằng tuần 03:00 UTC; chạy tay | CI cho app, gồm 7 job (bên dưới) |
| `.github/workflows/deploy.yml` | ✅ Hoàn chỉnh | Tự chạy sau khi workflow `CI` thành công trên `main` / chạy tay | Build image → Trivy gate → push lên Harbor → cập nhật tag trong Helm values để Argo CD đồng bộ |
| `.github/workflows/terraform.yml` | ✅ Hoàn chỉnh | PR/push có sửa `infrastructure/**`; lịch hằng ngày 20:00 UTC (quét drift) / chạy tay | `fmt`/`validate` → Checkov → `plan` → `apply`/`destroy` (chờ phê duyệt), đăng nhập AWS bằng OIDC, môi trường `dev`/`test`/`prod` |

**Các job của `ci.yml`:**

1. `changes` — xác định backend/frontend nào có thay đổi (path filter), tạo ma trận build dùng chung cho các job sau
   và cho `deploy.yml`.
2. `backend-lint-test` — ESLint (`--max-warnings=0`) + Jest kèm coverage.
3. `frontend-lint-test` — `next lint` + Jest kèm coverage.
4. `gitleaks` — quét secret bị lộ trong code/lịch sử Git (cấu hình `.gitleaks.toml`).
5. `sonarqube` — SAST + đọc coverage LCOV, kiểm tra Quality Gate; chỉ chạy với PR vào `main` hoặc push `main`,
   chờ 2 job lint/test ở trên.
6. `trivy-fs` — quét CVE trong dependency/lockfile của repo (mức `CRITICAL`, `HIGH`): đẩy kết quả SARIF lên tab
   Security và **chặn pipeline** nếu còn lỗ hổng chưa được bỏ qua trong `security/.trivyignore`.
7. `docker-build-check` — build thử image của service có thay đổi (không push; bỏ qua khi push vào `main` vì
   `deploy.yml` sẽ build lại) rồi quét Trivy image, chặn pipeline nếu có `CRITICAL`/`HIGH`.

**Các bước của `deploy.yml`:** build image backend/frontend (frontend nhận `NEXT_PUBLIC_API_URL` qua build arg) →
quét Trivy (gate) → push lên Harbor với tag là SHA commit và `latest` → sửa `backendTag`/`frontendTag` trong file
Helm values (đường dẫn lấy từ biến `HELM_VALUES_FILE`) rồi commit lại với `[skip ci]` → Argo CD phát hiện thay
đổi trên Git và tự rollout phiên bản mới.

### Cấu hình bảo mật & chất lượng

| File | Trạng thái | Mô tả |
|---|---|---|
| `.gitleaks.toml` | ✅ Hoàn chỉnh | Cấu hình GitLeaks, allowlist các file mẫu (`.env.example`...) |
| `security/.checkov.yaml` | ✅ Hoàn chỉnh | Danh sách check Checkov được bỏ qua kèm lý do cho `infrastructure/`; check còn lại không đạt thì pipeline fail |
| `sonar-project.properties` | ✅ Hoàn chỉnh | Cấu hình SonarQube/SonarCloud — quét chung backend + frontend, đọc coverage LCOV từ Jest |
| `security/.trivyignore` | 🔲 Placeholder | Danh sách CVE bỏ qua khi quét Trivy — hiện chưa có CVE nào được bỏ qua |

### Docker & scripts

| File | Trạng thái | Mô tả |
|---|---|---|
| `docker/backend.Dockerfile` | ✅ Hoàn chỉnh | Multi-stage build NestJS: build stage (đủ devDependencies) → cài lại production dependencies → image cuối chỉ chứa `dist` + `node_modules` production, kèm CA bundle RDS, chạy bằng user non-root |
| `docker/frontend.Dockerfile` | ✅ Hoàn chỉnh | Multi-stage build Next.js `output: 'standalone'`; nhận `NEXT_PUBLIC_API_URL` qua build arg |
| `docker/docker-compose.yml` | ✅ Hoàn chỉnh | Compose full stack: `postgres` (16-alpine) + `minio` + `minio-init` (tự tạo bucket & set public) + `backend` + `frontend` |
| `scripts/seed.sh` | ✅ Hoàn chỉnh | Seed dữ liệu mẫu vào database |
| `scripts/seed-rds-via-bastion.sh` | ✅ Hoàn chỉnh | Seed dữ liệu vào RDS (nằm trong private subnet) thông qua bastion EC2 |
| `scripts/setup-harbor-ec2.sh` | ✅ Hoàn chỉnh | Cài Harbor lên EC2 từ xa |
| `scripts/install-eks-tools.sh` | ✅ Hoàn chỉnh | Cài các tool nền tảng lên EKS (ALB Controller, EBS CSI, Traefik, Argo CD, Argo Rollouts, KEDA, kube-prometheus-stack) |
| `infrastructure/scripts/bootstrap-tfstate.sh`, `infrastructure/scripts/tf.sh` | ✅ Hoàn chỉnh | Tạo S3 bucket lưu Terraform state; wrapper chạy Terraform theo từng môi trường |
| `scripts/migrate.sh` | 🔲 Placeholder | Chạy TypeORM migrations (production — không dùng synchronize) |

> Chạy Docker Compose từ thư mục gốc project:
> ```bash
> docker compose -f docker/docker-compose.yml up -d --build
> ```
> (Context build là thư mục gốc `..` vì các Dockerfile COPY theo path `backend/...`
> và `frontend/...` để tận dụng cache layer hiệu quả hơn.)

---

## 10. Hướng dẫn khởi tạo CI-CD pipeline

Pipeline của project được dựng dần theo **10 bước**, mỗi bước có một file hướng dẫn riêng và bước sau dựa trên kết quả của
bước trước. Hãy làm đúng thứ tự dưới đây: từ chạy app bằng Docker Compose ở local, dựng registry Harbor, đưa lên K3s
local với GitOps/canary/giám sát/autoscaling, rồi triển khai lên AWS EKS thủ công và cuối cùng tự động hóa toàn bộ hạ
tầng bằng Terraform + GitHub Actions.

![CI-CD pipeline](docs/diagrams/CI-CD%20pipeline/CI-CD%20pipeline.png)

| Bước | Tài liệu | Làm gì | Chạy ở đâu |
|---|---|---|---|
| 1 | Docker Compose (`docker/`) | Chạy cả stack app bằng container | Máy local |
| 2 | `docker/harbor/harbor-setup.md` | Dựng Harbor registry | Server Linux riêng |
| 3 | `docs/k3s-n-helm-local-deployment-guide.md` | Deploy app lên K3s bằng Helm | K3s local |
| 4 | `docs/argocd-rolling-update-guide.md` | GitOps với Argo CD + rolling update | K3s local |
| 5 | `docs/argo-rollouts-canary-guide.md` | Canary deployment | K3s local |
| 6 | `docs/prometheus-grafana-alertmanager-monitoring-guide.md` | Giám sát + cảnh báo | K3s local |
| 7 | `docs/keda-autoscaling-guide.md` | Autoscaling theo metric | K3s local |
| 8 | `docs/eks-manual-deployment-guide.md` | Dựng hạ tầng EKS bằng tay | AWS |
| 9 | `docs/terraform-infrastructure-guide.md` | Tự động hóa hạ tầng AWS bằng Terraform | AWS |
| 10 | `docs/terraform-ci-github-actions-guide.md` | CI/CD cho Terraform | GitHub Actions + AWS |

### Bước 1 — Chạy app bằng Docker Compose ở local

- **File:** `docker/docker-compose.yml`, `docker/backend.Dockerfile`, `docker/frontend.Dockerfile`.
- **Nội dung:** build image cho backend/frontend và chạy toàn bộ stack (PostgreSQL 16, MinIO + job tự tạo bucket,
  backend, frontend) bằng một lệnh `docker compose -f docker/docker-compose.yml up -d --build` từ thư mục gốc. Khi seed dữ
  liệu mẫu cho bản chạy Compose, đặt `SEED_MEDIA_BASE_URL`=http://minio:9000/electronics-shop trỏ đúng MinIO host mà pod Frontend truy cập được.
- **Mục đích:** chắc chắn app build được và chạy đúng trong container trước khi đưa vào pipeline — các Dockerfile này chính
  là thứ `ci.yml` và `deploy.yml` sẽ build sau này.

### Bước 2 — Dựng Harbor registry

- **File:** [`docker/harbor/harbor-setup.md`](docker/harbor/harbor-setup.md).
- **Nội dung:** chuẩn bị server Linux riêng, cài Docker, tải và cấu hình Harbor (HTTPS bằng Let's Encrypt nếu có domain,
  hoặc self-signed cert nếu chỉ có IP), tạo Project và **Robot Account** để push/pull, cấu hình Docker client tin cert,
  thử `docker push`/`pull`, rồi lấy các giá trị để khai báo GitHub Secrets (`HARBOR_*`). Có thêm phần gỡ cert và bảo
  trì Harbor.
- **Mục đích:** có nơi lưu image để `deploy.yml` đẩy lên và K3s/EKS kéo về.

### Bước 3 — Dựng K3s local và deploy bằng Helm

- **File:** [`docs/k3s-n-helm-local-deployment-guide.md`](docs/k3s-n-helm-local-deployment-guide.md)
- **Nội dung:** cài K3s trên WSL2 và Helm, cho K3s tin CA self-signed của Harbor để kéo được image, deploy chart
  `helm/electronics-shop` (backend/frontend Deployment + HPA, PostgreSQL và MinIO dạng StatefulSet, Ingress Traefik),
  trỏ domain local, seed dữ liệu và kiểm tra app. Có ghi lại các lỗi thực tế đã gặp và checklist những điểm cần đổi khi
  chuyển sang EKS.
- **Mục đích:** có app chạy trên Kubernetes; chart này là nền để các bước sau nâng cấp dần.

### Bước 4 — Argo CD và Rolling Update

- **File:** [`docs/argocd-rolling-update-guide.md`](docs/argocd-rolling-update-guide.md)
- **Nội dung:** cài Argo CD vào K3s, đăng nhập UI, kết nối repo Git private, tạo `Application` trỏ vào chart Helm (qua
  UI hoặc `kubectl apply` các file mẫu trong `argo/`), bật auto-sync. Sau đó demo rolling update bằng dữ liệu thật: đẩy
  code → `ci.yml` + `deploy.yml` build/push image mới và sửa tag trong Helm values → Argo CD tự đồng bộ.
- **Mục đích:** hoàn thiện vòng CD theo GitOps — Git là nguồn sự thật, cluster tự cập nhật theo Git.

### Bước 5 — Argo Rollouts và Canary Deployment

- **File:** [`docs/argo-rollouts-canary-guide.md`](docs/argo-rollouts-canary-guide.md)
- **Nội dung:** cài Argo Rollouts (+ Dashboard) và dùng chính Traefik có sẵn trong K3s làm traffic router (không cần
  plugin ngoài). Chuyển backend/frontend từ `Deployment` sang `Rollout` ở chart `helm/electronics-shop-rollout`, chia
  traffic theo từng bước (có điểm dừng chờ promote), đổi biến `HELM_VALUES_FILE` để `deploy.yml` ghi tag đúng chart, trỏ
  Argo CD Application sang chart mới và thử promote/abort canary.
- **Mục đích:** phát hành phiên bản mới an toàn — chỉ một phần traffic đi vào bản mới trước khi chuyển hết.

### Bước 6 — Prometheus, Grafana, Alertmanager

- **File:** [`docs/prometheus-grafana-alertmanager-monitoring-guide.md`](docs/prometheus-grafana-alertmanager-monitoring-guide.md)
- **Nội dung:** cài `kube-prometheus-stack` (Prometheus + Grafana + Alertmanager), cấu hình Alertmanager gửi cảnh báo qua
  email, rồi dùng chart `helm/electronics-shop-monitoring` để thu thập metric từ backend/frontend (endpoint `/metrics`,
  `/api/metrics`) qua `PodMonitor`, nạp Grafana dashboard tự động từ Git (**dashboard-as-code**, qua ConfigMap) và định
  nghĩa luật cảnh báo.
- **Mục đích:** quan sát được app đang chạy ra sao; metric `http_requests_total` ở bước này là đầu vào của bước 7.

### Bước 7 — KEDA autoscaling

- **File:** [`docs/keda-autoscaling-guide.md`](docs/keda-autoscaling-guide.md)
- **Nội dung:** cài KEDA (`keda/keda-values.yaml`) và chuyển autoscaling từ HPA (chỉ CPU/RAM) sang `ScaledObject` ở chart
  `helm/electronics-shop-keda`, với 3 trigger: CPU, memory và request rate lấy từ Prometheus. Có phần test scale
  lên/xuống bằng tải giả lập.
- **Mục đích:** scale theo tải nghiệp vụ thật thay vì chỉ theo tài nguyên.

### Bước 8 — Triển khai lên AWS EKS (thao tác tay)

- **File:** [`docs/eks-manual-deployment-guide.md`](docs/eks-manual-deployment-guide.md)
- **Nội dung:** dựng toàn bộ hạ tầng từ đầu bằng AWS Console để hiểu từng thành phần: VPC/subnet, IAM, EKS cluster và node
  group, RDS PostgreSQL (mật khẩu do Secrets Manager quản lý), S3, OIDC/IRSA, EC2 cho Harbor và Bastion, domain miễn phí
  (dynv6) + chứng chỉ ACM. Sau đó cài các tool nền tảng (`scripts/install-eks-tools.sh`: ALB Controller, EBS CSI, Traefik,
  Argo CD, Argo Rollouts, KEDA, kube-prometheus-stack), cấu hình GitHub, deploy chart `helm/electronics-shop-eks`
  (dùng RDS/S3 thay Postgres/MinIO), seed RDS qua bastion (`scripts/seed-rds-via-bastion.sh`), trỏ DNS và kiểm tra.
- **Mục đích:** đưa toàn bộ những gì đã làm ở K3s lên môi trường cloud thật.

### Bước 9 — Tự động hóa hạ tầng bằng Terraform

- **File:** [`docs/terraform-infrastructure-guide.md`](docs/terraform-infrastructure-guide.md)
- **Nội dung:** dùng thư mục `infrastructure/` để tạo lại bằng code phần hạ tầng AWS (VPC, IAM,
  EKS, RDS, S3, OIDC/IRSA, node group, EC2 Harbor + Bastion, ACM, CloudWatch alarms). Giải thích cấu trúc module, 3 môi
  trường `dev`/`test`/`prod`, lưu state trên S3 (`scripts/bootstrap-tfstate.sh`), chạy bằng `scripts/tf.sh`, phần nào
  vẫn phải làm tay, cách `destroy`, lỗi thường gặp và lưu ý chi phí.
- **Mục đích:** dựng/hủy hạ tầng lặp lại được bằng lệnh, thay cho click console.

### Bước 10 — CI/CD cho hạ tầng bằng GitHub Actions

- **File:** [`docs/terraform-ci-github-actions-guide.md`](docs/terraform-ci-github-actions-guide.md)
- **Nội dung:** mô tả workflow `.github/workflows/terraform.yml`: luồng `fmt` → `validate` → Checkov → `plan` →
  `apply`/`destroy` (chờ phê duyệt), khi nào chạy gì (PR, push, lịch quét drift hằng ngày, chạy tay), đăng nhập AWS
  bằng OIDC thay vì access key, các Secrets/Variables/Environments cần tạo trên GitHub, cách chạy `apply` lần đầu, và
  các lỗi thường gặp.
- **Mục đích:** mọi thay đổi hạ tầng đều được kiểm tra bảo mật và duyệt trước khi áp dụng — hoàn tất pipeline cho cả app
  (`ci.yml`, `deploy.yml`) lẫn hạ tầng (`terraform.yml`). Chi tiết từng workflow xem [mục 9](#9-devsecops).

---

## 11. Lộ trình tách Microservices

Khi traffic tăng, mỗi module đã chuẩn để tách thành service độc lập:

```
Bước 1 — Thêm message broker (RabbitMQ / Kafka)
         order.service.ts  → emit event "order.created"
         inventory.service → subscribe, tự động trừ kho

Bước 2 — Tách module ra repo riêng
         catalog-service/  ← copy src/modules/catalog
         order-service/    ← copy src/modules/order
         ...

Bước 3 — Thay Service injection bằng HTTP client / gRPC
         Thêm API Gateway (Kong / AWS API Gateway / Nginx)

Bước 4 — Mỗi service có DB riêng (Database per Service pattern)
         catalog-db (PostgreSQL), order-db (PostgreSQL), cache (Redis)
```

> Thiết kế hiện tại **không có circular dependency** giữa các modules — sẵn sàng cho bước tách này mà không cần refactor logic.

---

## 12. Troubleshooting

### ❌ `peer authentication failed for user "postgres"`
Lỗi khi chạy `psql -U postgres` trực tiếp trên WSL2/Linux.

```bash
# Đúng: dùng sudo -u postgres
sudo -u postgres psql -c "SELECT version();"

# Hoặc đổi authentication method trong pg_hba.conf sang md5:
sudo nano /etc/postgresql/16/main/pg_hba.conf
# Đổi dòng: local all postgres peer  →  local all postgres md5
sudo service postgresql restart
```

### ❌ `Cannot connect to PostgreSQL` / `ECONNREFUSED 5432`

```bash
# Kiểm tra PostgreSQL có đang chạy
sudo service postgresql status

# Khởi động lại
sudo service postgresql restart

# Kiểm tra port đang lắng nghe
ss -tlnp | grep 5432
```

### ❌ `ECONNREFUSED 127.0.0.1:9000` (MinIO không chạy)

```bash
# Kiểm tra MinIO process
ps aux | grep minio

# Chạy lại
~/minio server ~/minio-data --console-address ":9001"

# Xem log nếu chạy background
tail -f ~/minio.log
```

### ❌ `mc: command not found`

```bash
# Dùng đường dẫn đầy đủ
~/mc alias set local http://localhost:9000 minioadmin minioadmin

# Hoặc thêm $HOME vào PATH
export PATH="$HOME:$PATH"
```

### ❌ `nest: command not found`

```bash
npm install -g @nestjs/cli
# Hoặc chạy qua npx (không cần cài global)
npx nest start --watch
```

### ❌ Ảnh sản phẩm không hiển thị (URL 403/404)

```bash
# Kiểm tra bucket policy
~/mc anonymous get local/electronics-shop

# Set lại public nếu chưa đúng
~/mc anonymous set public local/electronics-shop
```

### ❌ Lỗi CORS khi Frontend gọi Backend

- Kiểm tra biến `FRONTEND_URL` trong `backend/.env` (phải là `http://localhost:3000`)
- Đảm bảo backend đang thực sự chạy ở port 3001
- Thử hard-refresh browser (Ctrl+Shift+R) để xóa cache

### ❌ TypeORM không tạo được bảng

```bash
# Kiểm tra kết nối DB trong log backend
# Đảm bảo DB đã tồn tại
sudo -u postgres psql -c "\l" | grep electronics_shop

# Nếu chưa có, tạo lại
sudo -u postgres psql -c "CREATE DATABASE electronics_shop;"
```

### ❌ Seed lỗi `relation does not exist`

Backend cần chạy ít nhất một lần để TypeORM tạo bảng trước khi seed:

```bash
# Bước 1: chạy backend để tạo bảng
cd backend && npm run start:dev
# Chờ thấy "🚀 Backend running on http://localhost:3001"

# Bước 2: mở terminal mới, chạy seed
bash scripts/seed.sh
```

---

*Made with ❤️ — TechShop Boilerplate v1.0 | Stack: NestJS 10 · Next.js 15 · PostgreSQL 16 · MinIO*