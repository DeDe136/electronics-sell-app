/**
 * Test riêng cho phần cấu hình "SERVER-SIDE vs BROWSER" của axios instance
 * trong lib/api.ts:
 *   - baseURL: chọn INTERNAL_API_URL (server) hay NEXT_PUBLIC_API_URL (browser)
 *   - header "Host": chỉ set khi typeof window === 'undefined' (server-side)
 *     VÀ có process.env.INTERNAL_API_HOST_HEADER.
 *
 * Vì logic này chạy 1 LẦN DUY NHẤT lúc module được import (module-level code,
 * không nằm trong 1 function có thể gọi lại), nên để test được từng nhánh
 * (server có/không có header, browser) ta phải:
 *   1. jest.resetModules() để xoá cache, buộc lần require() tiếp theo chạy
 *      lại toàn bộ code ở top-level của module.
 *   2. Set process.env / xoá "window" TRƯỚC khi require lại module.
 *   3. Dùng require() (không dùng static import) vì cần trì hoãn việc load
 *      module tới đúng thời điểm mong muốn trong từng test case.
 */
describe('lib/api.ts — cấu hình baseURL & Host header theo môi trường', () => {
  const ORIGINAL_ENV = { ...process.env };
  const originalWindow = global.window;

  afterEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    // Khôi phục "window" về trạng thái ban đầu (môi trường test là jsdom
    // nên "window" luôn tồn tại theo mặc định).
    (global as any).window = originalWindow;
  });

  describe('Khi chạy trên SERVER (typeof window === "undefined")', () => {
    beforeEach(() => {
      jest.resetModules();
      delete (global as any).window;
    });

    it('gắn header Host khi có INTERNAL_API_HOST_HEADER', () => {
      process.env.INTERNAL_API_HOST_HEADER = 'shop.example.com';
      process.env.INTERNAL_API_URL = 'http://backend:3001/api/v1';

      const { api } = require('./api');

      expect(api.defaults.headers.Host).toBe('shop.example.com');
      expect(api.defaults.baseURL).toBe('http://backend:3001/api/v1');
    });

    it('KHÔNG gắn header Host khi thiếu INTERNAL_API_HOST_HEADER', () => {
      delete process.env.INTERNAL_API_HOST_HEADER;
      process.env.INTERNAL_API_URL = 'http://backend:3001/api/v1';

      const { api } = require('./api');

      expect(api.defaults.headers.Host).toBeUndefined();
    });

    it('dùng NEXT_PUBLIC_API_URL làm baseURL nếu không có INTERNAL_API_URL', () => {
      delete process.env.INTERNAL_API_URL;
      process.env.NEXT_PUBLIC_API_URL = 'https://api.public.example.com/api/v1';

      const { api } = require('./api');

      expect(api.defaults.baseURL).toBe('https://api.public.example.com/api/v1');
    });

    it('fallback về localhost khi không có biến môi trường nào', () => {
      delete process.env.INTERNAL_API_URL;
      delete process.env.NEXT_PUBLIC_API_URL;

      const { api } = require('./api');

      expect(api.defaults.baseURL).toBe('http://localhost:3001/api/v1');
    });
  });

  describe('Khi chạy trong TRÌNH DUYỆT (window tồn tại)', () => {
    beforeEach(() => {
      jest.resetModules();
      (global as any).window = originalWindow;
    });

    it('KHÔNG bao giờ gắn header Host, kể cả khi có INTERNAL_API_HOST_HEADER', () => {
      process.env.INTERNAL_API_HOST_HEADER = 'shop.example.com';

      const { api } = require('./api');

      expect(api.defaults.headers.Host).toBeUndefined();
    });

    it('dùng NEXT_PUBLIC_API_URL làm baseURL, bỏ qua INTERNAL_API_URL', () => {
      process.env.INTERNAL_API_URL = 'http://backend:3001/api/v1';
      process.env.NEXT_PUBLIC_API_URL = 'https://api.public.example.com/api/v1';

      const { api } = require('./api');

      expect(api.defaults.baseURL).toBe('https://api.public.example.com/api/v1');
    });
  });
});