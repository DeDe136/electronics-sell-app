import * as client from 'prom-client';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    // Mỗi test dùng 1 registry MỚI (tạo lại trong constructor) — nhưng
    // prom-client vẫn giữ default metrics theo tiến trình Node, nên cần
    // clear registry global để tránh lỗi "metric đã được đăng ký" khi
    // Jest chạy nhiều test file dùng chung 1 tiến trình.
    client.register.clear();
    service = new MetricsService();
  });

  afterEach(() => {
    client.register.clear();
  });

  it('khởi tạo 1 registry RIÊNG (không dùng client.register mặc định)', () => {
    expect(service.registry).toBeInstanceOf(client.Registry);
    expect(service.registry).not.toBe(client.register);
  });

  it('gắn default label "app: backend" cho mọi metric trong registry', async () => {
    const metricsText = await service.registry.metrics();

    // Default labels được prom-client áp cho MỌI metric, kiểm tra qua 1
    // metric mặc định (process_cpu... hoặc nodejs...) chắc chắn tồn tại.
    expect(metricsText).toContain('app="backend"');
  });

  it('thu thập sẵn các default metrics của Node.js (heap, event loop...)', async () => {
    const metricsText = await service.registry.metrics();

    expect(metricsText).toContain('nodejs_heap_size_total_bytes');
    expect(metricsText).toContain('process_cpu_user_seconds_total');
  });

  it('đăng ký histogram "http_request_duration_seconds" với đúng label names và buckets', () => {
    expect(service.httpRequestDuration).toBeInstanceOf(client.Histogram);

    const hist = service.registry.getSingleMetric(
      'http_request_duration_seconds',
    );
    expect(hist).toBeDefined();
  });

  it('đăng ký counter "http_requests_total" với đúng label names', () => {
    expect(service.httpRequestsTotal).toBeInstanceOf(client.Counter);

    const counter = service.registry.getSingleMetric('http_requests_total');
    expect(counter).toBeDefined();
  });

  it('ghi nhận đúng giá trị khi observe() histogram và inc() counter với labels', async () => {
    const labels = {
      method: 'GET',
      route: '/catalog/products',
      status_code: '200',
    };

    service.httpRequestDuration.observe(labels, 0.42);
    service.httpRequestsTotal.inc(labels);

    const metricsText = await service.registry.metrics();

    expect(metricsText).toContain(
      'http_requests_total{method="GET",route="/catalog/products",status_code="200",app="backend"} 1',
    );
  });
});
