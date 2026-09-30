variable "name_prefix" {
  description = "Tiền tố đặt tên IAM role / node group."
  type        = string
}

variable "cluster_name" {
  type = string
}

variable "kubernetes_version" {
  description = "Phiên bản Kubernetes. null = bản mặc định mới nhất EKS hỗ trợ."
  type        = string
  default     = null
}

variable "subnet_ids" {
  description = "Tất cả subnet của cluster (2 public + 2 private)."
  type        = list(string)
}

variable "node_subnet_ids" {
  description = "Subnet đặt worker node (2 private subnet)."
  type        = list(string)
}

variable "log_retention_days" {
  description = "Số ngày giữ log control plane trên CloudWatch Logs."
  type        = number
  default     = 30
}

variable "cluster_admin_principal_arns" {
  description = <<-EOT
    ARN IAM user/role được cấp quyền admin trên cluster (Access Entry + AmazonEKSClusterAdminPolicy).
    Principal chạy `terraform apply` ĐÃ tự là admin, KHÔNG thêm lại vào đây (sẽ lỗi trùng Access Entry).
  EOT
  type        = list(string)
  default     = []
}

variable "node_instance_type" {
  type    = string
  default = "t3.medium"
}

variable "node_disk_size" {
  type    = number
  default = 20
}

variable "node_min_size" {
  type    = number
  default = 2
}

variable "node_desired_size" {
  type    = number
  default = 2
}

variable "node_max_size" {
  type    = number
  default = 3
}
