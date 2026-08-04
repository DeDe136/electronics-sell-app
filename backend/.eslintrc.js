// =============================================================================
// .ESLINTRC.JS — Cấu hình ESLint cho backend NestJS
// -----------------------------------------------------------------------------
// Theo đúng chuẩn mà Nest CLI sinh ra khi tạo project mới (nest new), gồm:
//  - @typescript-eslint: bộ rule kiểm tra riêng cho TypeScript (type-aware)
//  - plugin:prettier/recommended: đồng bộ format code với Prettier, báo lỗi
//    ESLint nếu code không đúng format thay vì chỉ chạy 2 tool tách rời.
// =============================================================================
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    // Trỏ tới tsconfig để bật rule "type-aware" (vd: no-floating-promises,
    // cần biết kiểu trả về Promise hay không) — mạnh hơn rule chỉ check cú pháp.
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true, // để ESLint không báo lỗi "describe/it/expect is not defined" trong file *.spec.ts
  },
  ignorePatterns: ['.eslintrc.js', 'dist', 'node_modules'],
  rules: {
    // Các rule sau tắt vì đặc thù NestJS dùng decorator + DI khiến những rule
    // này gây false-positive nhiều hơn là hữu ích (đây cũng là default mà
    // Nest CLI đề xuất sẵn cho project mới):
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
