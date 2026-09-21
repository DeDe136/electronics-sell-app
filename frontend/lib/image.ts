// frontend/lib/image.ts
//
// Next.js Image Optimization ("/_next/image") tự fetch lại ảnh để resize/nén
// — với URL tuyệt đối (MinIO local, "http://minio:9000/...") việc này chạy
// bình thường vì Next gọi RA NGOÀI. Nhưng với URL nội bộ dạng
// "/api/images/{key}" (route proxy S3, xem app/api/images/[...key]/route.ts),
// Next phải TỰ GỌI LẠI CHÍNH NÓ — trên EKS, việc pod tự gọi ra ngoài qua ALB
// rồi vòng lại đúng chính nó (hairpin) bị chặn/lỗi, khiến ảnh không bao giờ
// load được (lỗi "isn't a valid image ... received null", request còn chưa
// từng tới được route của mình).
//
// Cách né: TẮT Image Optimization riêng cho đúng những ảnh dạng này (giữ
// nguyên optimization cho ảnh MinIO local, không đổi gì ở đó) — dùng prop
// "unoptimized" của next/image, bật/tắt dựa THẲNG vào hình dạng chuỗi URL,
// không cần thêm biến môi trường nào.
export function isApiImageProxyUrl(url: string | null | undefined): boolean {
  return !!url && url.startsWith('/api/images/');
}