variable "name" {
  description = "Tên EC2 (tag Name), vd: techshop-harbor."
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_id" {
  description = "Public subnet đặt EC2."
  type        = string
}

variable "key_name" {
  description = "Tên key pair đã tạo sẵn trên AWS (không có đuôi .pem)."
  type        = string
}

variable "instance_type" {
  type = string
}

variable "disk_size" {
  description = "Dung lượng root volume gp3 (GB)."
  type        = number
}

variable "security_group_name" {
  type = string
}

variable "security_group_description" {
  type    = string
  default = "Managed by Terraform"
}

variable "ingress_rules" {
  description = "Inbound rule TCP, key là tên rule. Mỗi rule có thể có nhiều CIDR."
  type = map(object({
    description = string
    port        = number
    cidr_blocks = list(string)
  }))
}

variable "allocate_elastic_ip" {
  description = "true = gắn Elastic IP cho instance."
  type        = bool
  default     = false
}
