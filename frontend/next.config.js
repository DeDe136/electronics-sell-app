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
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;