/**
 * Route dùng "Response" toàn cục (Web API) — cần "@jest-environment node"
 * vì jsdom (môi trường mặc định của project) không polyfill sẵn Response.
 * @jest-environment node
 */
import { GET, dynamic } from './route';

describe('GET /api/metrics', () => {
  afterEach(() => {
    // "getMetrics()" lưu registry vào globalThis — xoá sau mỗi test để
    // từng test bắt đầu với registry sạch, không bị ảnh hưởng bởi số liệu
    // (đặc biệt là bộ đếm http_requests_total) mà test trước để lại.
    delete (global as any).__prometheusMetrics;
  });

  it('export "dynamic = force-dynamic" để Next.js không cache response này', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('trả về Content-Type đúng định dạng Prometheus text mà registry quy định', async () => {
    const response = await GET();

    // Không hardcode chuỗi version cụ thể của prom-client — chỉ cần khớp
    // đúng giá trị mà chính registry khai báo, tránh test gãy nếu bản
    // prom-client sau này đổi format string.
    const { getMetrics } = await import('@/lib/metrics');
    expect(response.headers.get('Content-Type')).toBe(
      getMetrics().registry.contentType,
    );
  });

  it('trả về body chứa số liệu default metrics của Node.js (heap, CPU...)', async () => {
    const response = await GET();
    const body = await response.text();

    expect(body).toContain('nodejs_heap_size_total_bytes');
  });

  it('tự đếm chính request scrape của nó — gọi GET() lần 2 sẽ thấy http_requests_total của route "/api/metrics" xuất hiện (ghi nhận từ lần gọi trước)', async () => {
    await GET();
    const response = await GET();
    const body = await response.text();

    expect(body).toContain('route="/api/metrics"');
  });

  it('trả về HTTP status 200 khi lấy metrics thành công', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
  });
});