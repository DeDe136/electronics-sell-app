############################################
# Root module — ghép các module con thành hạ tầng hoàn chỉnh.
# Thứ tự phụ thuộc: vpc → (eks, ec2, s3, acm) → rds → iam-irsa; eks → cloudwatch-alarms
############################################
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs          = slice(data.aws_availability_zones.available.names, 0, 2)
  cluster_name = "${var.name_prefix}-cluster"
}

# ── Mạng ────────────────────────────────────────────────────────────────
module "vpc" {
  source = "./modules/vpc"

  name_prefix             = var.name_prefix
  vpc_cidr                = var.vpc_cidr
  availability_zones      = local.azs
  flow_log_retention_days = var.vpc_flow_log_retention_days
}

# ── EKS (cluster + node group + OIDC) ──────────────────────────────────
module "eks" {
  source = "./modules/eks"

  name_prefix        = var.name_prefix
  cluster_name       = local.cluster_name
  kubernetes_version = var.kubernetes_version

  subnet_ids      = concat(module.vpc.public_subnet_ids, module.vpc.private_subnet_ids)
  node_subnet_ids = module.vpc.private_subnet_ids

  log_retention_days           = var.cluster_log_retention_days
  cluster_admin_principal_arns = var.cluster_admin_principal_arns

  node_instance_type = var.node_instance_type
  node_disk_size     = var.node_disk_size
  node_min_size      = var.node_min_size
  node_desired_size  = var.node_desired_size
  node_max_size      = var.node_max_size
}

# ── Alarm CloudWatch cho log control plane ─────────────────────────────
module "cloudwatch_alarms" {
  source = "./modules/cloudwatch-alarms"

  name_prefix           = var.name_prefix
  cluster_name          = module.eks.cluster_name
  log_group_name        = module.eks.log_group_name
  alarm_email_addresses = var.alarm_email_addresses
  thresholds            = var.alarm_thresholds
}

# ── EC2: Harbor ở public subnet AZ 1, Bastion ở public subnet AZ 2 ─────
module "harbor" {
  source = "./modules/ec2"

  name                       = "${var.name_prefix}-harbor"
  vpc_id                     = module.vpc.vpc_id
  subnet_id                  = module.vpc.public_subnet_ids[0]
  key_name                   = var.harbor_key_name
  instance_type              = var.harbor_instance_type
  disk_size                  = var.harbor_disk_size
  security_group_name        = "harbor-sg"
  security_group_description = "Harbor registry"
  allocate_elastic_ip        = true

  ingress_rules = {
    http = {
      description = "HTTP (Lets Encrypt can xac minh tu moi noi)"
      port        = 80
      cidr_blocks = ["0.0.0.0/0"]
    }
    https = {
      description = "HTTPS"
      port        = 443
      cidr_blocks = ["0.0.0.0/0"]
    }
    ssh = {
      description = "SSH from admin"
      port        = 22
      cidr_blocks = var.admin_ssh_cidrs
    }
  }

  depends_on = [module.vpc] # cần Internet Gateway sẵn sàng trước khi gắn EIP
}

module "bastion" {
  source = "./modules/ec2"

  name                       = "${var.name_prefix}-bastion"
  vpc_id                     = module.vpc.vpc_id
  subnet_id                  = module.vpc.public_subnet_ids[1]
  key_name                   = var.bastion_key_name
  instance_type              = var.bastion_instance_type
  disk_size                  = var.bastion_disk_size
  security_group_name        = "bastion-host-sg"
  security_group_description = "Bastion host de seed DB / thao tac RDS"
  allocate_elastic_ip        = false

  ingress_rules = {
    ssh = {
      description = "SSH from admin"
      port        = 22
      cidr_blocks = var.admin_ssh_cidrs
    }
  }

  depends_on = [module.vpc]
}

# ── RDS PostgreSQL Multi-AZ ────────────────────────────────────────────
module "rds" {
  source = "./modules/rds"

  name_prefix = var.name_prefix
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids

  allowed_security_groups = {
    eks-cluster = module.eks.cluster_security_group_id
    bastion     = module.bastion.security_group_id
  }

  engine_version        = var.db_engine_version
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  username              = var.db_username
  db_name               = var.db_name
  backup_retention_days = var.db_backup_retention_days
  multi_az              = true
  deletion_protection   = var.db_deletion_protection
  skip_final_snapshot   = var.db_skip_final_snapshot
}

# ── S3 bucket ảnh ──────────────────────────────────────────────────────
module "s3" {
  source = "./modules/s3"

  bucket_name   = var.s3_bucket_name
  force_destroy = var.s3_force_destroy
}

# ── Chứng chỉ ACM wildcard ─────────────────────────────────────────────
module "acm" {
  source = "./modules/acm"

  domain_name = var.domain_name
}

# ── IAM policy + role IRSA (backend, frontend, ALB controller, EBS CSI) ─
module "iam_irsa" {
  source = "./modules/iam-irsa"

  name_prefix        = var.name_prefix
  oidc_provider_arn  = module.eks.oidc_provider_arn
  oidc_provider_host = module.eks.oidc_provider_host
  s3_bucket_arn      = module.s3.bucket_arn
  db_secret_arn      = module.rds.master_secret_arn
}
