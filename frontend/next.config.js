/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    // Next.js mặc định TỰ TỐI ƯU ảnh qua route nội bộ /_next/image — bước
    // này chạy TRÊN SERVER (bên trong container frontend), server sẽ tự đi
    // fetch ảnh gốc từ URL trong "src" để resize/nén trước khi trả về
    // trình duyệt.
    //
    // Vì bước fetch ảnh gốc xảy ra TRÊN SERVER (container frontend), URL
    // ảnh lưu trong DB (do backend/seed sinh ra) PHẢI là địa chỉ mà
    // CONTAINER FRONTEND phân giải được, tức "http://minio:9000" (tên
    // service trong docker network) — KHÔNG dùng "http://localhost:9000",
    // vì "localhost" từ trong container frontend trỏ về chính nó, không
    // phải container "minio".
    // (Xem SEED_MEDIA_BASE_URL trong backend/src/database/seeds/*.seed.ts
    // — phải set = "http://minio:9000/electronics-shop" khi seed dữ liệu
    // cho môi trường chạy qua Docker Compose.)
    //
    // Lưu ý: cách này CHỈ hoạt động khi frontend luôn chạy trong Docker.
    // Nếu chạy "npm run dev" trực tiếp trên máy host (không qua container)
    // trong khi DB đã seed với "minio:9000", ảnh sẽ vỡ vì host không phân
    // giải được "minio" — lúc đó cần seed lại với
    // SEED_MEDIA_BASE_URL=http://localhost:9000/electronics-shop.
    remotePatterns: [
      // MinIO — chạy trong Docker network (server-side fetch, xem giải
      // thích ở trên). Đây là hostname mà CONTAINER FRONTEND dùng.
      { protocol: 'http', hostname: 'minio', port: '9000' },
      // MinIO — trường hợp chạy Next.js server TRỰC TIẾP trên máy host
      // (không qua Docker), lúc đó "localhost" mới đúng là địa chỉ MinIO.
      // Giữ lại cả 2 pattern để linh hoạt chạy được cả 2 kiểu triển khai
      // mà không cần sửa next.config.js qua lại.
      { protocol: 'http', hostname: 'localhost', port: '9000' },
      // AWS S3
      { protocol: 'https', hostname: '*.amazonaws.com' },
      // Placeholder images
      { protocol: 'https', hostname: 'placehold.co' },
    ],
  },
  // Proxy API calls để tránh CORS trong dev
  // Hàm rewrites() chạy SERVER-SIDE bên trong container frontend, nên phải
  // dùng INTERNAL_API_URL (địa chỉ nội bộ trong docker network, ví dụ
  // "http://backend:3001/api") — KHÔNG dùng NEXT_PUBLIC_API_URL vì biến đó
  // trỏ tới địa chỉ mà BROWSER thấy (vd "localhost:3001"), mà "localhost"
  // từ trong container frontend lại trỏ về chính nó, không phải container
  // backend. Fallback về NEXT_PUBLIC_API_URL để vẫn chạy khi dev không qua
  // Docker (chạy trực tiếp trên máy, lúc đó cả 2 đều là localhost thật).
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${
          process.env.INTERNAL_API_URL ||
          process.env.NEXT_PUBLIC_API_URL ||
          'http://localhost:3001/api'
        }/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;