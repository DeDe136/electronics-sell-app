############################################
# Chứng chỉ ACM wildcard (DNS validation)
#
# dynv6 KHÔNG phải Route 53 nên Terraform không tự tạo được record xác thực.
# Sau khi apply: lấy output `validation_records`, tạo CNAME đó trên dynv6
# (Value phải có dấu '.' ở cuối), ACM sẽ tự chuyển sang Issued sau vài phút.
############################################
resource "aws_acm_certificate" "this" {
  domain_name       = "*.${var.domain_name}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}
