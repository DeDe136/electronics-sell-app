/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    // Next.js mặc định TỰ TỐI ƯU ảnh qua route nội bộ /_next/image — bước
    // này chạy TRÊN SERVER (bên trong container frontend), server sẽ tự đi
    // fetch ảnh gốc từ URL trong "src" để resize/nén trước khi trả về
    // trình duyệt.
    //
    // Ảnh sản phẩm của project này trỏ tới MinIO qua "http://localhost:9000"
    // (địa chỉ mà TRÌNH DUYỆT cần dùng). Nếu để Next.js tối ưu ảnh, chính
    // server bên trong container frontend sẽ cố fetch "localhost:9000" —
    // nhưng "localhost" trong container frontend trỏ về chính nó (không có
    // MinIO), không phải container "minio" → fetch thất bại → ảnh vỡ, dù
    // dán thẳng URL đó vào trình duyệt vẫn xem được bình thường (vì đó là
    // browser tự gọi trực tiếp, không qua container).
    //
    // unoptimized: true -> <Image> hoạt động gần giống <img> thường: trình
    // duyệt tự tải thẳng URL gốc, không qua bước server-fetch nữa -> tránh
    // hẳn vấn đề trên. Đánh đổi: mất tính năng Next.js tự động resize/nén
    // ảnh theo từng kích thước màn hình (ảnh vẫn hiển thị bình thường).
    unoptimized: true,
    remotePatterns: [
      // MinIO local
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