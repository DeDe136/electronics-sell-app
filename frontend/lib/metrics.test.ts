/**
 * prom-client's collectDefaultMetrics() dùng "setImmediate" (API thuần
 * Node.js, không tồn tại trong jsdom — môi trường mặc định của project) để
 * đo event loop lag — cần chỉ định "@jest-environment node".
 * @jest-environment node
 */
import * as client from 'prom-client';
import { getMetrics } from './metrics';

/**
 * getMetrics() lưu instance vào globalThis để sống sót qua các lần
 * Next.js tải lại module (hot-reload) trong CÙNG 1 tiến trình — test cần
 * xoá "global.__prometheusMetrics" sau mỗi case để không rò rỉ state giữa
 * các test.
 */
describe('lib/metrics.ts — getMetrics()', () => {
  afterEach(() => {
    delete (global as any).__prometheusMetrics;
  });

  it('tạo registry mới với đầy đủ registry/httpRequestDuration/httpRequestsTotal khi globalThis chưa có', () => {
    const metrics = getMetrics();

    expect(metrics.registry).toBeInstanceOf(client.Registry);
    expect(metrics.httpRequestDuration).toBeInstanceOf(client.Histogram);
    expect(metrics.httpRequestsTotal).toBeInstanceOf(client.Counter);
  });

  it('trả về CÙNG 1 instance khi gọi nhiều lần trong cùng tiến trình (singleton qua globalThis)', () => {
    const first = getMetrics();
    const second = getMetrics();

    expect(second).toBe(first);
  });

  it('tái sử dụng instance đã có sẵn trong globalThis thay vì tạo registry mới — tránh lỗi "metric đã được đăng ký" của prom-client khi module bị tải lại', () => {
    const existing = getMetrics();
    const registrySpy = jest.spyOn(client, 'Registry');

    const reused = getMetrics();

    expect(reused).toBe(existing);
    expect(registrySpy).not.toHaveBeenCalled();
    registrySpy.mockRestore();
  });

  it('gắn default label "app: frontend" cho mọi metric trong registry', async () => {
    const { registry } = getMetrics();
    const metricsText = await registry.metrics();

    expect(metricsText).toContain('app="frontend"');
  });

  it('thu thập sẵn default metrics của Node.js (heap, CPU...)', async () => {
    const { registry } = getMetrics();
    const metricsText = await registry.metrics();

    expect(metricsText).toContain('nodejs_heap_size_total_bytes');
    expect(metricsText).toContain('process_cpu_user_seconds_total');
  });

  it('httpRequestDuration/httpRequestsTotal ghi nhận đúng giá trị khi observe()/inc() với labels', async () => {
    const { registry, httpRequestDuration, httpRequestsTotal } = getMetrics();
    const labels = { method: 'GET', route: '/api/ping', status_code: '200' };

    httpRequestDuration.observe(labels, 0.05);
    httpRequestsTotal.inc(labels);

    const metricsText = await registry.metrics();

    expect(metricsText).toContain(
      'http_requests_total{method="GET",route="/api/ping",status_code="200",app="frontend"} 1',
    );
  });

  it('tạo lại registry mới (không throw lỗi trùng tên) nếu globalThis bị xoá rồi gọi lại — mô phỏng module bị tải lại', () => {
    getMetrics();
    delete (global as any).__prometheusMetrics;

    expect(() => getMetrics()).not.toThrow();
  });
});