/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
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