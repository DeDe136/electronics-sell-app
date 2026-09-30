variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  description = "2 private subnet cho DB subnet group."
  type        = list(string)
}

variable "allowed_security_groups" {
  description = "Map {tên = security group ID} được phép vào PostgreSQL (key phải là chuỗi tĩnh)."
  type        = map(string)
}

variable "engine_version" {
  description = "Phiên bản PostgreSQL. \"18\" = RDS tự chọn minor mặc định; có thể ghim như \"18.3\"."
  type        = string
  default     = "18"
}

variable "instance_class" {
  type    = string
  default = "db.m5.large"
}

variable "allocated_storage" {
  type    = number
  default = 20
}

variable "username" {
  description = "Master username (password do RDS tự sinh và quản lý trong Secrets Manager)."
  type        = string
}

variable "db_name" {
  type = string
}

variable "backup_retention_days" {
  type    = number
  default = 7
}

variable "multi_az" {
  description = "true = Multi-AZ DB instance deployment (2 instances)."
  type        = bool
  default     = true
}

variable "deletion_protection" {
  type    = bool
  default = false
}

variable "skip_final_snapshot" {
  type    = bool
  default = true
}
