import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const start = process.hrtime.bigint();

    // QUAN TRỌNG: dùng req.route.path (pattern gốc, vd
    // "/catalog/products/:id"), KHÔNG dùng req.url (URL thật, vd
    // "/catalog/products/42"). Nếu lỡ dùng req.url, mỗi ID sản phẩm khác
    // nhau sẽ tạo ra 1 label "route" riêng -> số time-series trong
    // Prometheus tăng vô hạn theo số record trong DB (cardinality
    // explosion) -> Prometheus tốn RAM/disk bất thường theo thời gian.
    const route = req.route?.path || req.url;

    return next.handle().pipe(
      tap(() => {
        const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
        const labels = {
          method: req.method,
          route,
          status_code: String(res.statusCode),
        };
        this.metrics.httpRequestDuration.observe(labels, durationSeconds);
        this.metrics.httpRequestsTotal.inc(labels);
      }),
    );
  }
}
