/**
 * Route Handler này chạy trong runtime Node/Edge của Next.js (dùng Web API
 * "Response" toàn cục), KHÔNG phải trong trình duyệt — nên chỉ định
 * "@jest-environment node" thay vì "jsdom" (mặc định của cả project, xem
 * jest.config.js), vì jsdom không polyfill sẵn "Response"/"fetch" toàn cục.
 * @jest-environment node
 */
import { GET } from './route';

/**
 * Test cho route "/api/ping" — dùng làm readiness/liveness probe của
 * Kubernetes cho Pod frontend.
 *
 * Trọng tâm cần đảm bảo (đúng lý do route này tồn tại, xem comment trong
 * route.ts):
 *   1. Trả về response nhẹ, tĩnh, KHÔNG gọi bất kỳ side-effect nào ra ngoài
 *      (không fetch backend, không đọc DB...) — khác với "/" (page.tsx) hay
 *      "/api/health-check" vốn tạo traffic thật mỗi lần probe gọi vào.
 *   2. Trả đúng shape JSON "{ status: 'ok' }" mà health probe mong đợi.
 *   3. HTTP status mặc định là 200 (probe coi "không phải 200" là unhealthy).
 */
describe('GET /api/ping', () => {
  it('trả về JSON { status: "ok" }', async () => {
    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ status: 'ok' });
  });

  it('trả về HTTP status 200 (readiness/liveness probe coi đây là "khoẻ mạnh")', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
  });

  it('không gọi fetch ra bên ngoài (probe không được phép tạo traffic tới backend)', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    await GET();

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('trả về response hợp lệ ngay cả khi gọi liên tục nhiều lần (mô phỏng probe gọi định kỳ mỗi ~10s)', async () => {
    const results = await Promise.all([GET(), GET(), GET()]);

    for (const response of results) {
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ status: 'ok' });
    }
  });
});