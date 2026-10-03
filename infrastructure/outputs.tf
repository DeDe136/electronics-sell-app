############################################
# Các giá trị cần "ghi lại" ở nhiều bước
############################################

# ── Mạng ───────────────────────────────────────────────────────────────
output "vpc_id" {
  value = module.vpc.vpc_id
}

output "public_subnet_ids" {
  value = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  value = module.vpc.private_subnet_ids
}

output "nat_gateway_public_ips" {
  description = "IP public của các NAT gateway (1 per AZ)."
  value       = module.vpc.nat_gateway_public_ips
}

# ── EKS ────────────────────────────────────────────────────────────────
output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "cluster_security_group_id" {
  value = module.eks.cluster_security_group_id
}

output "kubeconfig_command" {
  description = "Chạy lệnh này để kubectl kết nối cluster."
  value       = "aws eks update-kubeconfig --region ${var.region} --name ${module.eks.cluster_name}"
}

output "cluster_log_group" {
  description = "CloudWatch log group chứa log control plane."
  value       = module.eks.log_group_name
}

output "alarm_sns_topic_arn" {
  value = module.cloudwatch_alarms.sns_topic_arn
}

# ── IRSA ───────────────────────────────────────────────────────────────
output "backend_irsa_role_arn" {
  value = module.iam_irsa.backend_role_arn
}

output "frontend_irsa_role_arn" {
  value = module.iam_irsa.frontend_role_arn
}

output "alb_controller_role_arn" {
  value = module.iam_irsa.alb_controller_role_arn
}

output "ebs_csi_role_arn" {
  value = module.iam_irsa.ebs_csi_role_arn
}

# ── RDS / S3 ───────────────────────────────────────────────────────────
output "rds_endpoint" {
  value = module.rds.endpoint
}

output "rds_master_secret_arn" {
  value = module.rds.master_secret_arn
}

output "s3_bucket" {
  value = module.s3.bucket_name
}

# ── ACM ────────────────────────────────────────────────────────────────
output "acm_certificate_arn" {
  value = module.acm.certificate_arn
}

output "acm_validation_records" {
  description = "Tạo CNAME này trên dynv6 (Value phải có dấu '.' ở cuối)."
  value       = module.acm.validation_records
}

# ── EC2 ────────────────────────────────────────────────────────────────
output "harbor_public_ip" {
  description = "Tạo A record `harbor` trên dynv6 trỏ vào IP này."
  value       = module.harbor.public_ip
}

output "harbor_ssh_command" {
  value = "ssh -i ${var.harbor_key_name}.pem ubuntu@${module.harbor.public_ip}"
}

output "bastion_public_ip" {
  value = module.bastion.public_ip
}

output "bastion_ssh_command" {
  value = "ssh -i ${var.bastion_key_name}.pem ubuntu@${module.bastion.public_ip}"
}

