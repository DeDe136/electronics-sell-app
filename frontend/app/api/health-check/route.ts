// frontend/app/internal/health-check/route.ts
export async function GET() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

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
}