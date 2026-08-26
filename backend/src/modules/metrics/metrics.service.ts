import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService {
  // Registry RIÊNG (không dùng client.register mặc định) — tránh đụng
  // độ nếu sau này có lib khác cũng tự đăng ký metric vào registry global.
  public readonly registry: client.Registry;

  public readonly httpRequestDuration: client.Histogram<string>;
  public readonly httpRequestsTotal: client.Counter<string>;

  constructor() {
    this.registry = new client.Registry();
    this.registry.setDefaultLabels({ app: 'backend' });

    // Metric mặc định của Node.js: heap memory, event loop lag, GC,
    // số file descriptor đang mở... — không cần tự viết, prom-client
    // tự thu thập định kỳ (5s/lần mặc định).
    client.collectDefaultMetrics({ register: this.registry });

    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Thời gian xử lý 1 HTTP request (giây)',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Tổng số HTTP request đã xử lý',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });
  }
}
