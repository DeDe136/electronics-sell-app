// frontend/instrumentation.ts
//
// "Instrumentation Hook" — tính năng có sẵn của Next.js, tự động chạy 1
// lần DUY NHẤT ngay lúc server khởi động (trước khi nhận request đầu
// tiên), không cần gọi tay ở đâu cả — chỉ cần đặt đúng tên file này ở
// thư mục gốc project (ngang hàng next.config.js).
export async function register() {
  // QUAN TRỌNG: hook này chạy CẢ 2 runtime Next.js hỗ trợ — 'nodejs' VÀ
  // 'edge' (nếu app có dùng Edge Function nào khác). prom-client và
  // @vercel/otel (phần server) dùng các API thuần Node.js (process,
  // perf_hooks...) không tồn tại ở Edge Runtime — nếu thiếu điều kiện
  // check dưới đây, Next.js sẽ cố bundle chúng vào cả phần Edge, gây lỗi
  // build hoặc crash lúc khởi động.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getMetrics } = await import('./lib/metrics');
    // Gọi 1 lần để khởi tạo registry + collectDefaultMetrics ngay lúc
    // server start, không đợi tới khi có request đầu tiên mới tạo —
    // tránh trường hợp lần scrape đầu tiên của Prometheus tới sớm hơn
    // request thật đầu tiên của người dùng, dẫn đến /api/metrics trả về
    // rỗng ở lần đầu.
    getMetrics();

    // Đăng ký OpenTelemetry — dùng ĐỂ ĐO DURATION CHO TRANG SSR (không có
    // cơ chế nào khác trong Next.js làm được việc này, xem giải thích
    // trong otel-metrics-processor.ts). "auto" giữ lại toàn bộ tính năng
    // tự động instrument mặc định của Next.js (tạo root span cho mỗi
    // request, span con cho fetch...); thêm PrometheusMetricsSpanProcessor
    // để mỗi khi 1 root span kết thúc, tự ghi duration đó vào registry
    // Prometheus sẵn có (dùng chung 1 registry/Histogram với API routes,
    // xem otel-metrics-processor.ts).
    const { registerOTel } = await import('@vercel/otel');
    const { PrometheusMetricsSpanProcessor } = await import(
      './lib/otel-metrics-processor'
    );

    registerOTel({
      serviceName: 'frontend',
      spanProcessors: ['auto', new PrometheusMetricsSpanProcessor()],
    });
  }
}