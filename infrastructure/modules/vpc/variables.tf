variable "name_prefix" {
  description = "Tiền tố đặt tên tài nguyên (vd: techshop, techshop-dev)."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR của VPC (/16). Subnet được chia tự động thành 4 khối /20."
  type        = string
}

variable "availability_zones" {
  description = "Danh sách AZ (đúng 2 AZ). Mỗi AZ có 1 public subnet, 1 private subnet và 1 NAT gateway riêng."
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) == 2
    error_message = "Cần đúng 2 Availability Zone."
  }
}

variable "flow_log_retention_days" {
  description = "Số ngày giữ VPC Flow Logs trên CloudWatch Logs."
  type        = number
  default     = 14
}
