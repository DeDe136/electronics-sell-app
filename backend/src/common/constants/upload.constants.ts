/**
 * Giới hạn dùng chung cho các endpoint upload ảnh (avatar, ảnh sản phẩm...).
 *
 * Lý do cần validate ở đây thay vì chỉ ghi trong Swagger docs:
 * - Trước đây các endpoint upload chỉ MÔ TẢ giới hạn trong @ApiBody (Swagger),
 *   nhưng không có code nào thực sự enforce → client có thể upload BẤT KỲ
 *   file nào (kể cả file không phải ảnh, hoặc ảnh cố tình làm sai cấu trúc
 *   để khai thác lỗi decode ở tầng xử lý ảnh phía frontend/CDN).
 * - Việc validate mimetype + kích thước ở đây là lớp phòng thủ đầu tiên,
 *   chặn phần lớn file rác/độc hại trước khi file được lưu vào storage.
 *
 * Lưu ý: `mimetype` do client gửi lên (qua header Content-Type của phần
 * multipart) về lý thuyết có thể bị giả mạo, nhưng NestJS FileTypeValidator
 * mặc định kiểm tra theo "magic number" (byte đầu file) chứ không chỉ tin
 * theo header, nên vẫn có giá trị chặn file giả dạng đơn giản.
 */
export const IMAGE_UPLOAD_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Regex khớp theo phần mở rộng / mimetype ảnh được phép: jpg, jpeg, png, webp
export const IMAGE_UPLOAD_ALLOWED_MIMETYPE_REGEX = /^image\/(jpe?g|png|webp)$/i;
