// frontend/app/api/ping/route.ts
//
// Route CHỈ dùng cho Kubernetes readiness/liveness probe của Pod frontend —
// mục đích DUY NHẤT là xác nhận tiến trình Next.js server đang chạy và nhận
// request được, KHÔNG kiểm tra gì thêm.
//
// KHÔNG dùng "/" (trang chủ, app/page.tsx) làm probe như trước đây, vì "/"
// là Server Component thật — mỗi lần probe gọi vào đều khiến Next.js phải
// render lại trang chủ, kéo theo gọi getProducts() -> gọi thật sang backend
// (qua Traefik) mỗi ~10 giây, dù không hề có người dùng thật nào truy cập.
//
// Cũng KHÔNG dùng lại route "/api/health-check" đã có sẵn — route đó viết
// ra để TỰ KIỂM TRA kết nối tới backend (có fetch(`${API_URL}/health`) bên
// trong), gán nó làm probe sẽ chỉ đổi tên traffic giả tạo ra, không giải
// quyết gốc vấn đề (probe vẫn tự tạo traffic gọi backend đều đặn).
//
// Route này không render page, không import bất kỳ component/data-fetching
// nào, không gọi backend — chỉ trả về 1 JSON tĩnh, cực nhẹ, đúng bản chất
// của 1 liveness/readiness check (chỉ hỏi "server có đang chạy không",
// không phải "toàn bộ hệ thống có hoạt động đúng không").
import { withMetrics } from '@/lib/with-metrics';

export const GET = withMetrics('/api/ping', async () => {
  return Response.json({ status: 'ok' });
});