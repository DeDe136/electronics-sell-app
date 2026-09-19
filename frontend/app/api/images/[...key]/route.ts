// frontend/app/api/images/[...key]/route.ts
//
// Route MỚI — chỉ được gọi tới khi backend chạy với STORAGE_PROVIDER=aws
// (xem backend/src/modules/storage/storage.service.ts, hàm buildPublicUrl
// nhánh AWS trả về đúng path "/api/images/{key}"). Khi chạy local với MinIO,
// backend trả URL tuyệt đối "http://minio:9000/..." như cũ, <Image> gọi
// thẳng URL đó qua remotePatterns trong next.config.js — route này KHÔNG
// bao giờ được gọi tới trong luồng local, không ảnh hưởng gì tới docs cũ.
//
// Lý do cần route riêng thay vì để <Image> gọi thẳng S3: bucket S3 trên EKS
// để PRIVATE (Block Public Access bật) — Next.js Image optimizer chỉ làm
// 1 GET thuần, không tự ký request kiểu AWS (SigV4), nên bucket private sẽ
// luôn trả 403 nếu gọi thẳng. Route này mới thật sự dùng AWS SDK để gọi S3
// có ký, credentials lấy tự động qua IRSA (ServiceAccount "frontend-sa"),
// không hardcode access key/secret key.
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { withMetrics } from '@/lib/with-metrics';

// Khởi tạo 1 lần ở module scope (tái dùng qua nhiều request, giống cách
// StorageService bên backend giữ 1 s3Client cho cả vòng đời process).
// KHÔNG truyền "credentials" — để SDK tự lấy qua IRSA, xem giải thích ở
// storage.service.ts (backend) áp dụng y hệt nguyên tắc ở đây.
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1',
});

// Tự suy ra Content-Type từ đuôi file thay vì tin metadata lưu trên
// S3 — metadata đó phụ thuộc hoàn toàn vào CÁCH ảnh được upload lên: Console
// UI thường tự nhận diện đúng, nhưng "aws s3 cp" (CLI) KHÔNG tự nhận diện
// nếu không truyền thêm "--content-type", mặc định gắn
// "binary/octet-stream" — không phải kiểu ảnh hợp lệ, khiến Next.js Image
// từ chối thẳng với lỗi "isn't a valid image ... received null". Suy từ
// đuôi file đảm bảo đúng bất kể ảnh được upload bằng cách nào.
const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};

function guessContentType(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TO_MIME[ext] ?? 'application/octet-stream';
}

async function handler(
  _req?: NextRequest,
  ctx?: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    return NextResponse.json(
      { message: 'AWS_S3_BUCKET chưa được cấu hình cho pod frontend.' },
      { status: 500 },
    );
  }

  const { key: keyParts } = (await ctx?.params) ?? { key: [] };
  const key = keyParts.join('/');

  if (!key) {
    return NextResponse.json({ message: 'Thiếu key ảnh.' }, { status: 400 });
  }

  try {
    const result = await s3Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );

    const body = await result.Body?.transformToByteArray();
    if (!body) {
      return NextResponse.json(
        { message: 'Không tìm thấy nội dung ảnh.' },
        { status: 404 },
      );
    }

    return new NextResponse(Buffer.from(body), {
      status: 200,
      headers: {
        'Content-Type': guessContentType(key),
        // Cache 1 ngày ở phía client/CDN — ảnh sản phẩm hiếm khi đổi nội
        // dung ứng với cùng 1 key (key có uuid random, ảnh mới luôn là key
        // mới, xem storage.service.ts hàm uploadFile).
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    // Không phân biệt lỗi 403 (không có quyền)/404 (không tồn tại) chi tiết
    // cho client — tránh lộ thông tin về việc key có tồn tại hay không.
    return NextResponse.json(
      { message: 'Không lấy được ảnh từ S3.' },
      { status: 404 },
    );
  }
}

export const GET = withMetrics('/api/images/[...key]', handler);