// frontend/app/api/health-check/route.ts
import { withMetrics } from '@/lib/with-metrics';

// Route handler này chạy SERVER-SIDE, bên trong container frontend
// (không phải trong trình duyệt) — nên KHÔNG dùng NEXT_PUBLIC_API_URL
// (biến đó trỏ tới địa chỉ mà BROWSER nhìn thấy, ví dụ "localhost:3001",
// mà "localhost" bên trong container frontend lại trỏ về chính nó, không
// phải container backend => sẽ luôn báo lỗi kết nối).
// Dùng INTERNAL_API_URL (server-only, set trong docker-compose = tên
// service "http://backend:3001/api/v1") thay vào đó. Fallback về
// NEXT_PUBLIC_API_URL để vẫn chạy được khi dev trực tiếp trên máy (không
// qua Docker), lúc đó cả hai đều là localhost thật.
export const GET = withMetrics('/api/health-check', async () => {
  const API_URL =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001/api/v1';

  try {
    const res = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });

    if (res.ok) {
      console.log(`✅ [API] Kết nối backend thành công — ${API_URL}`);
      return Response.json({ connected: true });
    } else {
      console.warn(`⚠️  [API] Backend phản hồi HTTP ${res.status} — ${API_URL}`);
      return Response.json({ connected: false, status: res.status });
    }
  } catch (err: any) {
    const reason = err?.name === 'TimeoutError'
      ? 'timeout sau 5 giây'
      : 'backend chưa chạy hoặc không thể kết nối';
    console.error(`❌ [API] Không kết nối được backend — ${API_URL} (${reason})`);
    return Response.json({ connected: false, reason });
  }
});