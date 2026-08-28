// frontend/app/api/metrics/route.ts
import { getMetrics } from '@/lib/metrics';
import { withMetrics } from '@/lib/with-metrics';

// Bắt buộc — nếu không, Next.js có thể cache response này (App Router
// mặc định cố cache GET Route Handler không có dấu hiệu "dynamic" rõ
// ràng), khiến Prometheus luôn nhận lại đúng 1 bản snapshot cũ thay vì
// số liệu mới nhất mỗi lần scrape.
export const dynamic = 'force-dynamic';

// Bọc withMetrics để chính request scrape của Prometheus cũng được đếm —
// khớp với cách backend đang làm (route "/metrics" bên NestJS cũng tự đếm
// chính nó qua Interceptor toàn cục, không có gì bất thường). Route này
// bị otel-metrics-processor.ts loại trừ (mọi "/api/*" đều bị loại để
// tránh đếm trùng với các route dùng withMetrics), nên PHẢI tự bọc ở đây
// thì mới có số liệu — không bọc thì route này sẽ không được đo bởi bất
// kỳ nguồn nào cả.
export const GET = withMetrics('/api/metrics', async () => {
  const { registry } = getMetrics();
  const body = await registry.metrics();
  return new Response(body, {
    headers: { 'Content-Type': registry.contentType },
  });
});