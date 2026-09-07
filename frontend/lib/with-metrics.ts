// frontend/lib/with-metrics.ts
//
// Bọc quanh 1 Route Handler (app/api/.../route.ts) để tự động đo thời
// gian xử lý + đếm request — đóng đúng vai trò HttpMetricsInterceptor bên
// backend NestJS, nhưng viết dạng Higher-Order Function (HOF) vì Next.js
// Route Handler không có khái niệm Interceptor toàn cục áp dụng tự động
// cho mọi route như NestJS — phải tự bọc tay từng route muốn đo.
import { NextRequest } from 'next/server';
import { getMetrics } from './metrics';

type RouteHandler = (
  req?: NextRequest,
  ctx?: any,
) => Promise<Response> | Response;

export function withMetrics(
  routeName: string,
  handler: RouteHandler,
): RouteHandler {
  return async (req, ctx) => {
    const metrics = getMetrics();
    const start = process.hrtime.bigint();
    let statusCode = 200;
    // req optional — cho phép gọi trực tiếp trong unit test kiểu
    // `await GET()` (không dựng NextRequest giả), khớp cách các route
    // handler đơn giản (ping, metrics) đã được test từ trước. Không có
    // req thì không biết method thật, mặc định "GET" vì cả 2 route đang
    // dùng wrapper này đều chỉ export GET.
    const method = req?.method ?? 'GET';

    try {
      const res = await handler(req, ctx);
      statusCode = res.status;
      return res;
    } catch (err) {
      statusCode = 500;
      throw err;
    } finally {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const labels = {
        method,
        route: routeName,
        status_code: String(statusCode),
      };
      metrics.httpRequestDuration.observe(labels, durationSeconds);
      metrics.httpRequestsTotal.inc(labels);
    }
  };
}