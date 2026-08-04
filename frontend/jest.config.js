// =============================================================================
// JEST.CONFIG.JS — Cấu hình test cho frontend (Next.js App Router)
// -----------------------------------------------------------------------------
// Dùng "next/jest" (do chính Next.js cung cấp) thay vì tự cấu hình ts-jest/
// babel thủ công, vì next/jest tự động:
//  - Nạp đúng next.config.js và file .env khi chạy test
//  - Transform TypeScript/JSX qua SWC (nhanh hơn babel-jest nhiều lần)
//  - Tự mock CSS/SCSS import và next/image, next/font
//  - Tự hiểu path alias "@/*" khai báo trong tsconfig.json
// =============================================================================
const nextJest = require('next/jest');

// Trỏ tới thư mục gốc chứa next.config.js để next/jest nạp đúng cấu hình
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customJestConfig = {
  // Chạy 1 file setup sau khi môi trường test khởi tạo xong, dùng để nạp
  // các custom matcher của @testing-library/jest-dom (vd: toBeInTheDocument())
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // "jsdom" mô phỏng môi trường trình duyệt (window, document...) — bắt buộc
  // vì component React cần DOM giả lập để render/test, khác với backend
  // (Node) chỉ cần "node" environment thuần.
  testEnvironment: 'jest-environment-jsdom',

  // Cho phép import "@/components/Button" thay vì đường dẫn tương đối dài,
  // đồng bộ với path alias "@/*" đã khai báo trong tsconfig.json.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Chỉ tính coverage trên code thực sự chạy trong app, loại trừ file cấu
  // hình, type declaration, và các thư mục build/generated.
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coverageDirectory: 'coverage',

  // Frontend hiện CHƯA có file test nào (*.test.tsx) — bật cờ này để job
  // CI không fail giả tạo vì "no tests found". Khi có test thật mà fail,
  // Jest vẫn báo lỗi và chặn merge bình thường như mọi khi.
  passWithNoTests: true,
};

// next/jest là async function nên phải export qua createJestConfig(...)
// để nó merge cấu hình SWC/next.config vào customJestConfig ở trên.
module.exports = createJestConfig(customJestConfig);
