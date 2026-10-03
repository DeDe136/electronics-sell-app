############################################
# S3 bucket ảnh — private hoàn toàn (Block Public Access BẬT),
# frontend đọc qua route proxy /api/images/[...key] dùng IRSA.
############################################
resource "aws_s3_bucket" "this" {
  bucket        = var.bucket_name
  force_destroy = var.force_destroy
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Versioning: tránh mất/ghi đè nhầm ảnh sản phẩm; kết hợp lifecycle bên dưới
# để không phình chi phí lưu trữ do version cũ tích luỹ vô hạn.
resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = "Enabled"
  }
}

# SSE-S3 (AES256, không tốn thêm phí) — ảnh sản phẩm không phải dữ liệu nhạy
# cảm nên dùng KMS CMK riêng (tốn thêm ~1 USD/tháng/key) là không cần thiết.
resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    id     = "cleanup"
    status = "Enabled"

    # Dọn multipart upload bị bỏ dở (ví dụ upload lỗi giữa chừng) sau 7 ngày
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    # Version cũ (sau khi bị ghi đè/xoá) giữ 30 ngày để khôi phục khi cần,
    # sau đó xoá hẳn để không tích luỹ chi phí lưu trữ vô thời hạn
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}
