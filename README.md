# 🛍️ TechShop — Electronics E-Commerce

![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?style=flat&logo=nodedotjs&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E?style=flat&logo=nestjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=nextdotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-latest-C72E49?style=flat&logo=minio&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-4.x-433E38?style=flat&logo=react&logoColor=white)

> **Modular Monolith** — dễ tách thành Microservices khi cần scale.  
> *Ứng dụng thương mại điện tử bán đồ điện tử, đánh giá trên WSL2 Ubuntu 22.04*
>
> Có 2 cách chạy project: cài **native** từng service theo hướng dẫn ở mục 5–7 bên dưới, hoặc
> chạy **toàn bộ stack qua Docker Compose** (`docker compose -f docker/docker-compose.yml up -d --build`)
> — xem chi tiết ở mục 10.

---

## 📋 Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Cây thư mục chi tiết](#2-cây-thư-mục-chi-tiết)
3. [Mô tả từng module Backend](#3-mô-tả-từng-module-backend)
4. [Mô tả Frontend](#4-mô-tả-frontend)
5. [Yêu cầu hệ thống](#5-yêu-cầu-hệ-thống)
6. [Cài đặt môi trường](#6-cài-đặt-môi-trường)
7. [Hướng dẫn chạy local](#7-hướng-dẫn-chạy-local)
8. [API Reference](#8-api-reference)
9. [Biến môi trường](#9-biến-môi-trường)
10. [DevSecOps](#10-devsecops)
11. [Lộ trình tách Microservices](#11-lộ-trình-tách-microservices)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Tổng quan kiến trúc

```
Browser (Next.js 14 App Router)
        │  HTTP / REST
        ▼
NestJS API  ──►  PostgreSQL 16  (TypeORM, auto-sync dev)
        │
        └──────►  MinIO / AWS S3  (ảnh sản phẩm, avatar)
```

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

---

## 2. Cây thư mục chi tiết

```
electronics-shop/
│
├── .github/
│   └── workflows/
│       ├── ci.yml              # [Placeholder] CI: lint → test → build Docker image
│       └── deploy.yml          # [Placeholder] CD: deploy lên staging/production
│
├── docker/
│   ├── backend.Dockerfile      # ✅ Multi-stage build NestJS → production image (đã triển khai)
│   ├── frontend.Dockerfile     # ✅ Multi-stage build Next.js standalone output (đã triển khai)
│   └── docker-compose.yml      # ✅ Full stack: backend + frontend + postgres + minio (đã triển khai)
│
├── scripts/
│   ├── migrate.sh              # [Placeholder] Chạy TypeORM migrations (production)
│   └── seed.sh                 # Seed dữ liệu mẫu vào database (chạy được)
│
├── security/
│   ├── .trivyignore            # Danh sách CVE bỏ qua khi scan Docker image bằng Trivy
│   └── owasp-zap.conf          # Config OWASP ZAP automated security scan
│
├── sonar-project.properties    # Config SonarQube/SonarCloud scanner (quét chung backend + frontend)
│
├── .gitignore                  # Ignore node_modules, .env, dist, .next, minio-data...
│
├── backend/                    # ════════ NestJS API ════════
│   ├── src/
│   │   ├── main.ts             # Entrypoint: bootstrap app, cấu hình CORS, ValidationPipe,
│   │   │                       # global prefix /api/v1, Swagger (bật/tắt qua ENABLE_SWAGGER,
│   │   │                       # mặc định chỉ bật khi NODE_ENV !== 'production')
│   │   ├── app.module.ts       # Root module: load ConfigModule, TypeOrmModule,
│   │   │                       # import tất cả feature modules, đăng ký HealthController
│   │   ├── health.controller.ts # GET /api/v1/health — health check đơn giản (status + timestamp),
│   │   │                        # dùng bởi Docker healthcheck / frontend health-check route
│   │   ├── types/
│   │   │   └── express.d.ts    # Mở rộng type Express.Request (đính kèm user từ JWT)
│   │   │
│   │   ├── config/
│   │   │   └── configuration.ts  # Load & type-safe toàn bộ biến môi trường từ .env
│   │   │                         # (port, database, jwt, storage.aws, storage.minio)
│   │   │
│   │   ├── common/               # Shared dùng toàn app
│   │   │   ├── decorators/
│   │   │   │   └── roles.decorator.ts  # @Roles('admin') — gắn metadata role vào route
│   │   │   │                           # @CurrentUser() — inject user từ JWT payload
│   │   │   └── guards/
│   │   │       ├── jwt-auth.guard.ts   # Guard xác thực Bearer token JWT
│   │   │       └── roles.guard.ts      # Guard phân quyền: kiểm tra role từ @Roles()
│   │   │
│   │   ├── database/
│   │   │   └── seeds/                  # ── Seed dữ liệu mẫu (đã hoàn chỉnh) ──
│   │   │       ├── run-seeds.ts        # Entrypoint seed: khởi tạo DataSource độc lập,
│   │   │       │                       # chạy tuần tự theo thứ tự phụ thuộc
│   │   │       ├── category.seed.ts    # Seed danh mục (Điện thoại, Laptop, Tablet...)
│   │   │       ├── product.seed.ts     # Seed sản phẩm với specs JSONB đầy đủ
│   │   │       ├── variant.seed.ts     # Seed biến thể sản phẩm (màu, cấu hình, giá)
│   │   │       ├── inventory.seed.ts   # Seed tồn kho theo SKU
│   │   │       ├── user.seed.ts        # Seed tài khoản mẫu (admin + user thường)
│   │   │       ├── order.seed.ts       # Seed đơn hàng với snapshot OrderItems
│   │   │       ├── cart.seed.ts        # Seed giỏ hàng mẫu
│   │   │       └── payment-method-option.seed.ts  # Seed 4 phương thức thanh toán
│   │   │                                           # (cod, bank_transfer, momo, vnpay)
│   │   │
│   │   └── modules/              # ── Business Modules ──
│   │       │
│   │       ├── storage/          # Shared service — upload/xóa file S3 hoặc MinIO
│   │       │   ├── storage.module.ts   # Export StorageService (global) cho các module khác
│   │       │   └── storage.service.ts  # uploadFile, uploadFiles, deleteFile,
│   │       │                           # getPresignedUploadUrl (client direct upload),
│   │       │                           # getSignedReadUrl (private file access)
│   │       │                           # Dùng AWS SDK v3 — switch S3/MinIO qua STORAGE_PROVIDER
│   │       │
│   │       ├── auth/             # Xác thực: đăng ký, đăng nhập, JWT
│   │       │   ├── auth.module.ts      # Import PassportModule, JwtModule, UserModule
│   │       │   ├── auth.controller.ts  # POST /auth/register, POST /auth/login
│   │       │   ├── auth.service.ts     # bcryptjs hash (12 rounds), JWT sign
│   │       │   ├── dto/
│   │       │   │   └── auth.dto.ts     # RegisterDto (email, password, fullName),
│   │       │   │                       # LoginDto — validate bằng class-validator
│   │       │   └── strategies/
│   │       │       └── jwt.strategy.ts # Passport JWT strategy — extract Bearer token,
│   │       │                           # validate payload, load user từ DB
│   │       │
│   │       ├── user/             # Quản lý hồ sơ người dùng
│   │       │   ├── user.module.ts
│   │       │   ├── user.controller.ts  # GET /users/me, PATCH /users/me,
│   │       │   │                       # PATCH /users/me/avatar (multipart/form-data),
│   │       │   │                       # DELETE /users/me (tự xóa tài khoản),
│   │       │   │                       # GET /users/admin/all, GET /users/admin/:id,
│   │       │   │                       # PATCH /users/admin/:id (đổi role/khóa tài khoản),
│   │       │   │                       # DELETE /users/admin/:id  [Admin]
│   │       │   ├── user.service.ts     # getProfile, updateProfile, updateAvatar
│   │       │   │                       # (upload MinIO/S3, xóa ảnh cũ), deleteUser,
│   │       │   │                       # getAllUsers, updateUserByAdmin
│   │       │   └── entities/
│   │       │       └── user.entity.ts  # id (uuid), email (unique), password (excluded
│   │       │                           # khỏi select), fullName, phone, address,
│   │       │                           # avatarUrl, avatarKey, role ('user'|'admin')
│   │       │
│   │       ├── catalog/          # Danh mục sản phẩm điện tử
│   │       │   ├── catalog.module.ts
│   │       │   ├── catalog.controller.ts  # GET/POST/PATCH/DELETE /catalog/categories(/:id),
│   │       │   │                          # GET/POST/PATCH/DELETE /catalog/products(/:id|:slug)
│   │       │   │                          # (+ upload ảnh multipart),
│   │       │   │                          # GET /catalog/products/:id/variants,
│   │       │   │                          # GET /catalog/variants/:variantId,
│   │       │   │                          # POST /catalog/products/:id/variants,
│   │       │   │                          # PATCH/DELETE /catalog/variants/:variantId  [Admin]
│   │       │   ├── catalog.service.ts     # findAll (filter/sort/pagination),
│   │       │   │                          # findBySlug (tăng viewCount), create (+S3),
│   │       │   │                          # update, delete (+xóa ảnh S3)
│   │       │   ├── dto/
│   │       │   │   ├── create-product.dto.ts  # name, brand, price, salePrice,
│   │       │   │   │                          # categoryId, specs{}, variants[]
│   │       │   │   └── product-query.dto.ts   # search, categoryId, brand,
│   │       │   │                              # minPrice, maxPrice, specs filter,
│   │       │   │                              # sort (price_asc/desc, popular, newest),
│   │       │   │                              # page, limit
│   │       │   └── entities/
│   │       │       ├── product.entity.ts  # slug (auto-gen), specs: JSONB (RAM/CPU/Pin...),
│   │       │       │                      # images: [{url, key}], variants: [],
│   │       │       │                      # salePrice, soldCount, viewCount
│   │       │       ├── product-variant.entity.ts  # Biến thể: name, sku, price,
│   │       │       │                               # attributes (JSONB), stock
│   │       │       └── category.entity.ts  # name, slug, specFields[] (định nghĩa
│   │       │                               # các thông số đặc trưng cho từng loại thiết bị)
│   │       │
│   │       ├── cart/             # Giỏ hàng (lưu DB, không dùng session/cookie)
│   │       │   ├── cart.module.ts
│   │       │   ├── cart.controller.ts  # GET /cart, POST /cart/items,
│   │       │   │                       # PATCH /cart/items/:id, DELETE /cart/items/:id,
│   │       │   │                       # DELETE /cart/items (xóa nhiều item theo danh sách id),
│   │       │   │                       # DELETE /cart
│   │       │   ├── cart.service.ts     # getCart (kèm subtotal), addItem (auto-merge),
│   │       │   │                       # updateQuantity, removeItem, clearCart
│   │       │   └── entities/
│   │       │       └── cart-item.entity.ts  # userId, productId, variantId, quantity
│   │       │
│   │       ├── order/            # Đặt hàng
│   │       │   ├── order.module.ts
│   │       │   ├── order.controller.ts  # POST /orders (tạo từ cart),
│   │       │   │                        # POST /orders/buy-now (mua ngay 1 sản phẩm, không qua cart),
│   │       │   │                        # GET /orders (lịch sử), GET /orders/:id,
│   │       │   │                        # PATCH /orders/:id/cancel (khách tự hủy đơn),
│   │       │   │                        # GET /orders/admin/all, PATCH /orders/admin/:id/status,
│   │       │   │                        # DELETE /orders/admin/:id  [Admin]
│   │       │   ├── order.service.ts     # createFromCart chạy trong DB transaction:
│   │       │   │                        # tạo Order → snapshot OrderItems → clearCart
│   │       │   │                        # → rollback nếu lỗi; generateOrderCode
│   │       │   └── entities/
│   │       │       ├── order.entity.ts      # orderCode, shippingAddress (JSONB),
│   │       │       │                        # subtotal, shippingFee, discount, total,
│   │       │       │                        # status (pending/confirmed/shipping/delivered/
│   │       │       │                        # cancelled/refunded)
│   │       │       └── order-item.entity.ts # Snapshot: productName, unitPrice, quantity
│   │       │                                # (bảo toàn giá tại thời điểm đặt hàng)
│   │       │
│   │       ├── payment/          # Thanh toán
│   │       │   ├── payment.module.ts
│   │       │   ├── payment.controller.ts  # GET /payments/methods (danh sách phương thức),
│   │       │   │                          # POST /payments (khởi tạo),
│   │       │   │                          # GET /payments/order/:orderId, GET /payments/:id,
│   │       │   │                          # POST /payments/webhook/vnpay (VNPay callback),
│   │       │   │                          # PATCH /payments/admin/:id/status,
│   │       │   │                          # DELETE /payments/admin/:id  [Admin]
│   │       │   ├── payment.service.ts     # initiate (COD tự confirm ngay),
│   │       │   │                          # confirm (từ webhook), getByOrder
│   │       │   └── entities/
│   │       │       ├── payment.entity.ts  # method (cod/bank_transfer/momo/vnpay), status
│   │       │       │                      # (pending/success/failed/refunded),
│   │       │       │                      # transactionId, metadata (JSONB)
│   │       │       └── payment-method-option.entity.ts  # Danh mục phương thức thanh toán
│   │       │                                             # động (code, name, icon, isActive,
│   │       │                                             # sortOrder, metadata) — frontend
│   │       │                                             # fetch bảng này để render lựa chọn
│   │       │                                             # thay vì hard-code
│   │       │
│   │       └── inventory/        # Quản lý tồn kho
│   │           ├── inventory.module.ts
│   │           ├── inventory.controller.ts  # GET /inventory/:productId,
│   │           │                            # PUT /inventory/:productId [Admin only]
│   │           ├── inventory.service.ts     # getStock, setStock, adjustStock
│   │           └── entities/
│   │               └── inventory.entity.ts  # sku (productId hoặc productId-variantId),
│   │                                        # quantity (tổng), reserved (đang giữ),
│   │                                        # available = quantity - reserved,
│   │                                        # lowStockThreshold (cảnh báo)
│   │
│   ├── .env.example    # Template biến môi trường (commit được, không chứa secret)
│   ├── package.json    # NestJS 10, TypeORM 0.3, AWS SDK v3, bcryptjs, passport-jwt...
│   └── tsconfig.json   # TypeScript config cho NestJS
│
└── frontend/           # ════════ Next.js 14 App Router ════════
    ├── app/
    │   ├── layout.tsx          # Root layout: load font, render Navbar + Footer,
    │   │                       # wrap QueryClientProvider + Toaster
    │   ├── globals.css         # Tailwind @tailwind directives + custom CSS variables
    │   ├── globals.d.ts        # Type declarations toàn cục cho Next.js
    │   ├── providers.tsx       # React Query QueryClientProvider (client component)
    │   ├── page.tsx            # 🏠 Trang chủ (SSR): banner hero 3 cột, category pills,
    │   │                       # sidebar filter (giá, thương hiệu), product grid,
    │   │                       # sort dropdown, pagination
    │   ├── login/
    │   │   └── page.tsx        # 🔑 Trang đăng nhập / đăng ký: form toggle,
    │   │                       # validation, redirect sau login
    │   ├── products/
    │   │   └── [slug]/
    │   │       └── page.tsx    # 📱 Chi tiết sản phẩm (CSR): image gallery + thumbnails,
    │   │                       # chọn variant (màu/cấu hình) → giá thay đổi,
    │   │                       # quantity stepper, AddToCart / Mua ngay,
    │   │                       # bảng thông số ProductSpecs
    │   ├── cart/
    │   │   └── page.tsx        # 🛒 Giỏ hàng: danh sách items, quantity stepper inline,
    │   │                       # order summary (subtotal + phí ship), xóa item,
    │   │                       # chọn item → lưu vào sessionStorage → chuyển sang /checkout
    │   ├── checkout/
    │   │   └── page.tsx        # 💳 Thanh toán: đọc item đã chọn từ sessionStorage
    │   │                       # (do /cart ghi vào), form địa chỉ giao hàng, chọn phương
    │   │                       # thức thanh toán (fetch từ /payments/methods), tạo đơn
    │   │                       # qua POST /orders, redirect sang /order-success
    │   ├── buy-now/
    │   │   └── page.tsx        # ⚡ Mua ngay 1 sản phẩm (bỏ qua giỏ hàng): đọc item từ
    │   │                       # sessionStorage (do trang chi tiết sản phẩm ghi vào),
    │   │                       # form địa chỉ + phương thức thanh toán, tạo đơn qua
    │   │                       # POST /orders/buy-now
    │   ├── order-success/
    │   │   └── page.tsx        # ✅ Trang xác nhận đặt hàng thành công, hiển thị mã đơn
    │   │                       # hàng (orderCode) lấy từ query string
    │   ├── profile/
    │   │   └── page.tsx        # 👤 Trang cá nhân: tab Thông tin / Đơn hàng,
    │   │                       # edit inline, avatar upload, lịch sử đơn hàng, đăng xuất
    │   └── api/
    │       └── health-check/
    │           └── route.ts    # Route handler server-side: gọi GET /health của backend
    │                           # (qua INTERNAL_API_URL trong Docker, fallback
    │                           # NEXT_PUBLIC_API_URL khi chạy local) để kiểm tra kết nối
    │
    ├── components/
    │   ├── layout/
    │   │   ├── Navbar.tsx      # Sticky navbar: logo, search bar, cart badge (Zustand),
    │   │   │                   # avatar dropdown, mobile hamburger menu
    │   │   └── Footer.tsx      # Footer: links, thông tin liên hệ, copyright
    │   ├── product/
    │   │   ├── ProductCard.tsx      # Card sản phẩm: ảnh, brand badge, tên, specs pills,
    │   │   │                        # giá (salePrice nếu có), nút Add to Cart
    │   │   ├── ProductCard.test.tsx # Unit test cho ProductCard (Jest + Testing Library)
    │   │   ├── ProductSpecs.tsx     # Bảng thông số kỹ thuật với label tiếng Việt tự động
    │   │   │                        # (RAM, CPU, Pin, Màn hình, Camera...)
    │   │   └── ProductSpecs.test.tsx # Unit test cho ProductSpecs
    │   └── ui/
    │       ├── Button.tsx      # Shared button: variants (primary/outline/ghost/danger),
    │       │                   # sizes (sm/md/lg), loading state với spinner
    │       └── Button.test.tsx # Unit test cho Button
    │
    ├── lib/
    │   ├── api.ts              # Axios instance (baseURL = NEXT_PUBLIC_API_URL)
    │   │                       # Interceptors: tự gắn Authorization header từ localStorage,
    │   │                       # tự logout khi nhận 401; export catalogApi, cartApi,
    │   │                       # authApi, userApi, orderApi, paymentMethodApi
    │   ├── api.test.ts         # Unit test cho lib/api.ts
    │   └── hooks/
    │       ├── useCart.ts      # Zustand store: items[], subtotal, itemCount,
    │       │                   # fetchCart (sync với server), addItem, updateQuantity,
    │       │                   # removeItem — dùng xuyên suốt toàn app
    │       └── useCart.test.ts # Unit test cho useCart store
    │
    ├── .env.local.example      # Template env frontend (NEXT_PUBLIC_API_URL)
    ├── jest.config.js          # Cấu hình Jest + jsdom cho unit test frontend
    ├── jest.setup.js           # Setup file cho Testing Library (jest-dom matchers)
    ├── next.config.js          # output: 'standalone' (tối ưu cho Docker); cho phép load ảnh
    │                           # từ MinIO (localhost:9000 hoặc minio:9000 trong Docker) và S3;
    │                           # rewrite proxy /api/* → backend (dùng INTERNAL_API_URL trong
    │                           # Docker, fallback NEXT_PUBLIC_API_URL khi chạy local)
    ├── tailwind.config.js      # Tailwind CSS config (content paths, theme extend)
    ├── postcss.config.js       # PostCSS config cho Tailwind
    └── tsconfig.json           # TypeScript config cho Next.js
```

> **Testing:** Cả backend (Jest, file `*.spec.ts` cạnh mỗi service) lẫn frontend
> (Jest + React Testing Library, file `*.test.ts(x)`) đều có sẵn unit test.
> Chạy bằng `npm test` (hoặc `npm run test:cov` để lấy coverage) trong từng thư mục.

---

## 3. Mô tả từng module Backend

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
- **Từ giỏ hàng** (`POST /orders`) — chạy trong **database transaction**:
  1. Tạo `Order` record với mã đơn hàng tự sinh
  2. Snapshot từng `OrderItem` (tên SP, đơn giá tại thời điểm đặt)
  3. Xóa các item đã đặt khỏi giỏ hàng
  4. Rollback toàn bộ nếu bất kỳ bước nào lỗi
- **Mua ngay** (`POST /orders/buy-now`) — tạo đơn trực tiếp từ 1 sản phẩm/variant, không cần
  qua giỏ hàng

Khách hàng có thể tự hủy đơn qua `PATCH /orders/:id/cancel` (khi đơn còn ở trạng thái cho phép
hủy). Admin quản lý toàn bộ đơn hàng qua `GET /orders/admin/all`, cập nhật trạng thái qua
`PATCH /orders/admin/:id/status`, và xóa đơn qua `DELETE /orders/admin/:id`.

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

### ❤️ Health Controller (Shared)
`GET /api/v1/health` — health check đơn giản, trả về `{ status: 'ok', timestamp }`. Không cần
đăng nhập. Dùng bởi Docker healthcheck và route `frontend/app/api/health-check/route.ts` để
kiểm tra backend đã kết nối được chưa.

---

## 4. Mô tả Frontend

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

---

## 5. Yêu cầu hệ thống

| Công cụ | Phiên bản tối thiểu | Ghi chú |
|---|---|---|
| Node.js | 20 LTS | Dùng nvm để quản lý version |
| npm | 10+ | Đi kèm Node.js 20 |
| PostgreSQL | 16 | Chạy native hoặc Docker |
| MinIO | Latest | Chạy native (hướng dẫn bên dưới) |
| Git | 2.x | |

> **WSL2 (Windows):** Hướng dẫn này được viết và kiểm tra trên **WSL2 Ubuntu 22.04**. Tất cả lệnh dùng trong terminal WSL2. Không dùng PowerShell hay CMD.

---

## 6. Cài đặt môi trường

### 6.1 — Node.js 20 LTS (qua nvm)

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

### 6.2 — PostgreSQL 16

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

### 6.3 — MinIO (Object Storage)

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

**Chạy MinIO ở background (tuỳ chọn):**
```bash
# Chạy background với nohup
nohup ~/minio server ~/minio-data --console-address ":9001" > ~/minio.log 2>&1 &

# Kiểm tra đang chạy
ps aux | grep minio

# Dừng MinIO
pkill minio
```

### 6.4 — Git

```bash
# Ubuntu / WSL2
sudo apt install -y git

# Cấu hình cơ bản
git config --global user.name "Tên của bạn"
git config --global user.email "email@example.com"
```

---

## 7. Hướng dẫn chạy local

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

## 8. API Reference

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
  "productId": "uuid",
  "variantId": "uuid",
  "quantity": 1,
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
GET /api/v1/health     # → { "status": "ok", "timestamp": "..." } — không cần đăng nhập
```

---

## 9. Biến môi trường

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

## 10. DevSecOps

### Files đã hoàn chỉnh

| File | Trạng thái | Mô tả |
|---|---|---|
| `scripts/seed.sh` | ✅ Hoàn chỉnh | Seed dữ liệu mẫu vào database |
| `security/.trivyignore` | ✅ Hoàn chỉnh | Danh sách CVE bỏ qua khi scan Docker image bằng Trivy |
| `security/owasp-zap.conf` | ✅ Hoàn chỉnh | Config OWASP ZAP automated penetration testing |
| `sonar-project.properties` | ✅ Hoàn chỉnh | Config SonarQube/SonarCloud — quét chung backend + frontend, đọc coverage LCOV từ Jest |
| `docker/backend.Dockerfile` | ✅ Hoàn chỉnh | Multi-stage build NestJS: build stage (đầy đủ devDependencies) → stage cài lại production dependencies → image cuối chỉ chứa `dist` + `node_modules` production |
| `docker/frontend.Dockerfile` | ✅ Hoàn chỉnh | Multi-stage build Next.js `output: 'standalone'`; nhận `NEXT_PUBLIC_API_URL` qua build arg |
| `docker/docker-compose.yml` | ✅ Hoàn chỉnh | Compose full stack: `postgres` (16-alpine) + `minio` + `minio-init` (tự tạo bucket & set public) + `backend` + `frontend`, đều có healthcheck/`depends_on` hợp lý |
| `.github/workflows/ci.yml` | ✅ Hoàn chỉnh | 5 job chạy song song: `backend-lint-test`, `frontend-lint-test` (ESLint + Jest), `gitleaks` (quét secret rò rỉ), `sonarqube` (SAST, chờ 2 job lint/test), `trivy-fs` (quét CVE + misconfiguration) |

> Chạy Docker Compose từ thư mục gốc project:
> ```bash
> docker compose -f docker/docker-compose.yml up -d --build
> ```
> (Context build là thư mục gốc `..` vì các Dockerfile COPY theo path `backend/...`
> và `frontend/...` để tận dụng cache layer hiệu quả hơn.)

### Files placeholder (chưa triển khai)

| File | Mục đích |
|---|---|
| `.github/workflows/deploy.yml` | CD: tự động deploy lên staging/production (build & push image, deploy ECS/EC2/VPS, chạy migration, health check, notify Slack) |
| `scripts/migrate.sh` | Chạy TypeORM migrations (production — không dùng synchronize) |

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

*Made with ❤️ — TechShop Boilerplate v1.0 | Stack: NestJS 10 · Next.js 14 · PostgreSQL 16 · MinIO*