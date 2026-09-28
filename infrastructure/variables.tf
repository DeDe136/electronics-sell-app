############################################
# Chung
############################################
variable "environment" {
  description = "Tên môi trường: dev | test | prod."
  type        = string

  validation {
    condition     = contains(["dev", "test", "prod"], var.environment)
    error_message = "environment phải là dev, test hoặc prod."
  }
}

variable "region" {
  description = "AWS region cho toàn bộ hạ tầng."
  type        = string
  default     = "ap-southeast-1"
}

variable "name_prefix" {
  description = "Tiền tố đặt tên tài nguyên (IAM role, cluster, RDS...). Mỗi môi trường PHẢI khác nhau, vd: techshop-dev, techshop."
  type        = string
}

variable "domain_name" {
  description = "Domain gốc của app (zone trên dynv6). Chứng chỉ ACM sẽ là wildcard *.<domain_name>."
  type        = string
}

############################################
# VPC
############################################
variable "vpc_cidr" {
  description = "CIDR /16 của VPC. Mỗi môi trường nên dùng dải khác nhau."
  type        = string
}

############################################
# EKS
############################################
variable "kubernetes_version" {
  description = "Phiên bản Kubernetes. null = bản mặc định mới nhất EKS hỗ trợ."
  type        = string
  default     = null
}

variable "cluster_admin_principal_arns" {
  description = "ARN IAM user/role khác (ngoài người chạy terraform) cần quyền admin kubectl."
  type        = list(string)
  default     = []
}

variable "cluster_log_retention_days" {
  description = "Số ngày giữ log control plane trên CloudWatch Logs."
  type        = number
  default     = 30
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

############################################
# CloudWatch alarm
############################################
variable "alarm_email_addresses" {
  description = "Email nhận cảnh báo CloudWatch (phải bấm 'Confirm subscription' trong thư AWS gửi)."
  type        = list(string)
}

variable "alarm_thresholds" {
  description = "Ngưỡng (số dòng log khớp trong 5 phút) của từng alarm control plane."
  type = object({
    api_server_5xx       = number
    api_server_throttled = number
    api_unauthorized     = number
    authenticator_denied = number
    control_plane_errors = number
  })
  default = {
    api_server_5xx       = 5
    api_server_throttled = 20
    api_unauthorized     = 30
    authenticator_denied = 5
    control_plane_errors = 50
  }
}

############################################
# RDS
############################################
variable "db_engine_version" {
  description = "Phiên bản PostgreSQL. \"18\" = RDS tự chọn minor mới nhất; có thể ghim như \"18.3\"."
  type        = string
  default     = "18"
}

variable "db_instance_class" {
  type    = string
  default = "db.m5.large"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_username" {
  type    = string
  default = "techshop_admin"
}

variable "db_name" {
  type    = string
  default = "electronics_shop"
}

variable "db_backup_retention_days" {
  type    = number
  default = 7
}

variable "db_deletion_protection" {
  type    = bool
  default = false
}

variable "db_skip_final_snapshot" {
  type    = bool
  default = true
}

############################################
# S3
############################################
variable "s3_bucket_name" {
  description = "Tên bucket ảnh (duy nhất toàn cầu)."
  type        = string
}

variable "s3_force_destroy" {
  type    = bool
  default = false
}

############################################
# EC2 Harbor & Bastion
############################################
variable "admin_ssh_cidrs" {
  description = "CIDR (IP của bạn, dạng x.x.x.x/32) được SSH vào Harbor và Bastion."
  type        = list(string)

  validation {
    condition     = length(var.admin_ssh_cidrs) > 0 && !contains(var.admin_ssh_cidrs, "0.0.0.0/0")
    error_message = "admin_ssh_cidrs phải có ít nhất 1 CIDR và KHÔNG được là 0.0.0.0/0."
  }
}

variable "harbor_key_name" {
  description = "Tên key pair ĐÃ CÓ SẴN trên AWS (không có đuôi .pem)."
  type        = string
  default     = "harbor-keypair"
}

variable "bastion_key_name" {
  description = "Tên key pair ĐÃ CÓ SẴN trên AWS (không có đuôi .pem)."
  type        = string
  default     = "bastion-host-keypair"
}

variable "harbor_instance_type" {
  type    = string
  default = "t3.medium"
}

variable "harbor_disk_size" {
  type    = number
  default = 20
}

variable "bastion_instance_type" {
  type    = string
  default = "t3.micro"
}

variable "bastion_disk_size" {
  type    = number
  default = 8
}
