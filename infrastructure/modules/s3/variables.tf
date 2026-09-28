variable "bucket_name" {
  description = "Tên bucket (duy nhất toàn cầu)."
  type        = string
}

variable "force_destroy" {
  description = "true = cho phép terraform destroy xoá cả bucket đang còn object."
  type        = bool
  default     = false
}
