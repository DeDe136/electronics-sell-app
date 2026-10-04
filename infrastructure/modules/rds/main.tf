############################################
# RDS PostgreSQL
# - Multi-AZ DB instance deployment (2 instances: primary + standby)
# - Master credentials do RDS quản lý trong Secrets Manager (key aws/secretsmanager)
# - Chỉ các security group trong allowed_security_groups (EKS cluster SG, bastion) mới vào được port 5432
############################################
resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db-subnet-group"
  subnet_ids = var.subnet_ids

  tags = { Name = "${var.name_prefix}-db-subnet-group" }
}

resource "aws_security_group" "this" {
  name        = "${var.name_prefix}-rds-sg"
  description = "PostgreSQL RDS - chi cho EKS node va bastion"
  vpc_id      = var.vpc_id

  tags = { Name = "${var.name_prefix}-rds-sg" }
}

# for_each theo map (key tĩnh, value là SG ID) — an toàn khi SG ID chưa biết lúc plan
resource "aws_vpc_security_group_ingress_rule" "postgres" {
  for_each = var.allowed_security_groups

  security_group_id            = aws_security_group.this.id
  description                  = "PostgreSQL from ${each.key}"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = each.value
}

# ── Parameter group: bật query logging (DDL + câu lệnh chạy chậm >1s) ────
# Kết hợp với enabled_cloudwatch_logs_exports bên dưới để log thật sự chảy
# lên CloudWatch Logs thay vì chỉ nằm trên đĩa RDS.
locals {
  # "18" hoặc "18.3" → family "postgres18"
  db_parameter_group_family = "postgres${split(".", var.engine_version)[0]}"
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.name_prefix}-postgres-params"
  family = local.db_parameter_group_family

  parameter {
    name  = "log_statement"
    value = "ddl" # log các câu CREATE/ALTER/DROP, không log hết SELECT (tốn log + I/O)
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # log câu query chạy > 1000ms, hữu ích để bắt query chậm
  }

  # Bắt buộc SSL/TLS cho mọi kết nối tới DB (Checkov CKV2_AWS_69). PostgreSQL 15+ mặc định đã =1 nên khai báo
  # tường minh ở đây không đổi hành vi, chỉ để cấu hình không phụ thuộc giá trị mặc định của AWS.
  # "pending-reboot" hợp lệ cho cả tham số static lẫn dynamic (nếu để "immediate" mà đây là tham số static thì
  # RDS từ chối lúc apply); DB được tạo cùng parameter group nên không có gì phải chờ reboot.
  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }
}

# ── IAM role cho RDS Enhanced Monitoring (metric chi tiết mỗi 60s) ──────
data "aws_iam_policy_document" "monitoring_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["monitoring.rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "monitoring" {
  name               = "${var.name_prefix}-rds-monitoring-role"
  assume_role_policy = data.aws_iam_policy_document.monitoring_assume.json
}

resource "aws_iam_role_policy_attachment" "monitoring" {
  role       = aws_iam_role.monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

resource "aws_db_instance" "this" {
  identifier = "${var.name_prefix}-postgres"

  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  storage_type      = "gp3"
  allocated_storage = var.allocated_storage
  storage_encrypted = true

  db_name  = var.db_name
  username = var.username

  # Manage master credentials in AWS Secrets Manager (KMS key mặc định aws/secretsmanager)
  manage_master_user_password = true

  multi_az               = var.multi_az
  db_subnet_group_name   = aws_db_subnet_group.this.name
  parameter_group_name   = aws_db_parameter_group.this.name
  vpc_security_group_ids = [aws_security_group.this.id]
  publicly_accessible    = false

  backup_retention_period = var.backup_retention_days
  copy_tags_to_snapshot   = true

  # Đẩy log PostgreSQL (theo cấu hình ở parameter group) + log nâng cấp lên CloudWatch Logs
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  performance_insights_enabled = true
  auto_minor_version_upgrade   = true

  monitoring_interval = 60 # Enhanced Monitoring: lấy metric OS mỗi 60 giây
  monitoring_role_arn = aws_iam_role.monitoring.arn

  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.name_prefix}-postgres-final"
}
