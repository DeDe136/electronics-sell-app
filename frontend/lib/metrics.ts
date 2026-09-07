// frontend/lib/metrics.ts
//
// Singleton Prometheus registry cho tiến trình Next.js server (SSR).
// Dùng globalThis để lưu instance — cần thiết vì Next.js có thể tải lại
// (hot-reload/re-evaluate) module này nhiều lần trong 1 tiến trình (đặc
// biệt lúc `next dev`), nếu không lưu vào globalThis, prom-client sẽ báo
// lỗi "A metric with the name ... has already been registered" do đăng
// ký trùng Histogram/Counter mỗi lần module bị load lại.
import * as client from 'prom-client';

declare global {
  // eslint-disable-next-line no-var
  var __prometheusMetrics:
    | {
        registry: client.Registry;
        httpRequestDuration: client.Histogram<string>;
        httpRequestsTotal: client.Counter<string>;
      }
    | undefined;
}

function createMetrics() {
  const registry = new client.Registry();
  registry.setDefaultLabels({ app: 'frontend' });
  client.collectDefaultMetrics({ register: registry });

  const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Thời gian xử lý 1 request (API Route Handler hoặc trang SSR, xem otel-metrics-processor.ts) (giây)',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [registry],
  });

  const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Tổng số request đã xử lý (API Route Handler hoặc trang SSR)',
    labelNames: ['method', 'route', 'status_code'],
    registers: [registry],
  });

  return { registry, httpRequestDuration, httpRequestsTotal };
}

export function getMetrics() {
  if (!global.__prometheusMetrics) {
    global.__prometheusMetrics = createMetrics();
  }
  return global.__prometheusMetrics;
}