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
  vpc_security_group_ids = [aws_security_group.this.id]
  publicly_accessible    = false

  backup_retention_period = var.backup_retention_days

  performance_insights_enabled = true
  auto_minor_version_upgrade   = true

  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.name_prefix}-postgres-final"
}
