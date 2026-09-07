/**
 * Route dùng "Response"/"fetch"/"AbortSignal" toàn cục (Web API) — cần
 * "@jest-environment node" vì jsdom (mặc định của project) không polyfill
 * sẵn các API này.
 * @jest-environment node
 */
import { GET } from './route';

describe('GET /api/health-check', () => {
  const ORIGINAL_ENV = { ...process.env };
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
    // route.ts có console.log/warn/error để debug lúc vận hành thật — mock
    // đi để output test sạch, KHÔNG assert nội dung log (không phải hành
    // vi nghiệp vụ cần test, chỉ là log phụ trợ).
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    process.env = { ...ORIGINAL_ENV };
    delete (global as any).__prometheusMetrics;
    jest.restoreAllMocks();
  });

  it('trả về { connected: true } khi backend phản hồi OK', async () => {
    process.env.INTERNAL_API_URL = 'http://backend:3001/api/v1';
    fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ connected: true });
  });

  it('gọi đúng endpoint "${API_URL}/health"', async () => {
    process.env.INTERNAL_API_URL = 'http://backend:3001/api/v1';
    fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);

    await GET();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://backend:3001/api/v1/health',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('ưu tiên dùng INTERNAL_API_URL (server-side) thay vì NEXT_PUBLIC_API_URL', async () => {
    process.env.INTERNAL_API_URL = 'http://backend:3001/api/v1';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001/api/v1';
    fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);

    await GET();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://backend:3001/api/v1/health',
      expect.anything(),
    );
  });

  it('fallback về NEXT_PUBLIC_API_URL khi thiếu INTERNAL_API_URL', async () => {
    delete process.env.INTERNAL_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:9999/api/v1';
    fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);

    await GET();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:9999/api/v1/health',
      expect.anything(),
    );
  });

  it('fallback về "http://localhost:3001/api/v1" khi không có biến môi trường nào', async () => {
    delete process.env.INTERNAL_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);

    await GET();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/health',
      expect.anything(),
    );
  });

  it('trả về { connected: false, status } khi backend phản hồi lỗi HTTP (vd 503)', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 503 } as Response);

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ connected: false, status: 503 });
  });

  it('trả về { connected: false, reason: "timeout sau 5 giây" } khi fetch timeout', async () => {
    const timeoutError = new Error('timeout');
    timeoutError.name = 'TimeoutError';
    fetchSpy.mockRejectedValue(timeoutError);

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({
      connected: false,
      reason: 'timeout sau 5 giây',
    });
  });

  it('trả về { connected: false, reason: "backend chưa chạy..." } khi fetch lỗi kết nối (không phải timeout)', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({
      connected: false,
      reason: 'backend chưa chạy hoặc không thể kết nối',
    });
  });

  it('luôn trả HTTP status 200 ở tầng Route Handler dù backend down (lỗi được phản ánh qua field "connected", không qua status code)', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await GET();

    expect(response.status).toBe(200);
  });
});