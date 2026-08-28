// frontend/lib/otel-metrics-processor.ts
//
// SpanProcessor tuỳ biến — "nghe" MỌI span mà @vercel/otel tự động tạo
// ra cho từng request Next.js xử lý, kể cả TRANG SSR. Next.js tự tạo 1
// "root span" cho mỗi request, đặt tên dạng "GET /products/[slug]" —
// vòng đời span này khớp CHÍNH XÁC với vòng đời xử lý request thật
// (bắt đầu lúc nhận request, kết thúc lúc trả response xong, bao gồm cả
// thời gian render Server Component) — đây là cách duy nhất đo được
// duration cho SSR page trong Next.js (không có cơ chế kiểu Interceptor
// của NestJS chặn được tới lúc response thật sự hoàn tất).
import type { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-node';
import { getMetrics } from './metrics';

export class PrometheusMetricsSpanProcessor implements SpanProcessor {
  onStart(): void {
    // Không cần làm gì lúc span bắt đầu — chỉ quan tâm lúc kết thúc để
    // biết được duration.
  }

  onEnd(span: ReadableSpan): void {
    // parentSpanContext rỗng (undefined) => đây là span GỐC của cả 1
    // request (không có span cha) — không phải 1 trong các span con lồng
    // bên trong (gọi fetch, render 1 component con...). Chỉ span gốc mới
    // có thời lượng khớp đúng "cả request mất bao lâu".
    if (span.parentSpanContext?.spanId) return;

    const attrs = span.attributes;
    // Ưu tiên "next.route"/"http.route" (route PATTERN, vd
    // "/products/[slug]") thay vì span.name hay URL thật — đúng lý do đã
    // giải thích ở http-metrics.interceptor.ts bên backend: dùng route
    // pattern để tránh mỗi giá trị slug khác nhau tạo ra 1 time-series
    // riêng (cardinality explosion).
    //
    // .replace(/\\/g, '/'): trên Windows, "next.route" đôi lúc trả về
    // theo định dạng đường dẫn HỆ ĐIỀU HÀNH (dùng "\" thay vì "/"), ví dụ
    // "\api\metrics\route" thay vì "/api/metrics". Không chuẩn hoá, dòng
    // kiểm tra "route.includes('/api/')" bên dưới sẽ KHÔNG khớp, khiến
    // chính request Prometheus tới lấy /api/metrics bị đếm nhầm vào
    // thống kê (double-count) thay vì bị loại trừ.
    const route = (
      (attrs['next.route'] as string) ||
      (attrs['http.route'] as string) ||
      span.name
    ).replace(/\\/g, '/');

    // Loại TOÀN BỘ route bắt đầu bằng "/api/" khỏi OpenTelemetry — mọi
    // Route Handler (/api/health-check, /api/ping, /api/metrics) đều
    // được bọc withMetrics riêng (xem with-metrics.ts), đo trực tiếp
    // quanh handler thật, không phụ thuộc việc OpenTelemetry có bắt đúng
    // attribute hay không. Giữ cả 2 nguồn cùng ghi vào 1 metric sẽ đếm
    // trùng 2 lần cho cùng 1 request. Luật loại trừ CỐ TÌNH viết rộng
    // theo tiền tố "/api/" (không liệt kê từng route riêng lẻ), để nếu
    // sau này thêm Route Handler mới và bọc withMetrics cho nó, KHÔNG
    // cần nhớ quay lại sửa file này mới né được đếm trùng — tự động
    // được loại trừ theo đúng quy ước đặt route.
    if (route.includes('/api/')) return;

    const method =
      (attrs['http.method'] as string) || span.name.split(' ')[0] || 'GET';
    const statusCode =
      (attrs['http.status_code'] as number | undefined) ??
      (attrs['http.response.status_code'] as number | undefined) ??
      200;

    // HrTime là tuple [giây, nano-giây] biểu diễn THỜI LƯỢNG (không phải
    // mốc thời gian tuyệt đối) — cộng lại đúng như cách tính
    // durationSeconds trong http-metrics.interceptor.ts.
    const durationSeconds = span.duration[0] + span.duration[1] / 1e9;

    const metrics = getMetrics();
    const labels = { method, route, status_code: String(statusCode) };
    metrics.httpRequestDuration.observe(labels, durationSeconds);
    metrics.httpRequestsTotal.inc(labels);
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}