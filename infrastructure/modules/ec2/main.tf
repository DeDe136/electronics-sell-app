############################################
# 1 EC2 (Ubuntu 24.04 LTS) + Security Group riêng.
# Module dùng chung cho Harbor và Bastion — khác nhau ở biến truyền vào.
############################################
data "aws_ssm_parameter" "ubuntu_2404" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
}

# ── Security Group ─────────────────────────────────────────────────────
resource "aws_security_group" "this" {
  name        = var.security_group_name
  description = var.security_group_description
  vpc_id      = var.vpc_id

  tags = { Name = var.security_group_name }
}

locals {
  # Trải phẳng {rule => {port, cidr_blocks}} thành từng cặp (rule, cidr)
  ingress = merge([
    for rule_key, rule in var.ingress_rules : {
      for cidr in rule.cidr_blocks : "${rule_key}-${cidr}" => {
        description = rule.description
        port        = rule.port
        cidr        = cidr
      }
    }
  ]...)
}

resource "aws_vpc_security_group_ingress_rule" "this" {
  for_each = local.ingress

  security_group_id = aws_security_group.this.id
  description       = each.value.description
  ip_protocol       = "tcp"
  from_port         = each.value.port
  to_port           = each.value.port
  cidr_ipv4         = each.value.cidr
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.this.id
  description       = "Allow all outbound traffic"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# ── Instance ───────────────────────────────────────────────────────────
resource "aws_instance" "this" {
  ami                         = data.aws_ssm_parameter.ubuntu_2404.value
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [aws_security_group.this.id]
  key_name                    = var.key_name # key pair ĐÃ CÓ SẴN trên AWS
  associate_public_ip_address = true
  ebs_optimized               = true

  root_block_device {
    volume_type = "gp3"
    volume_size = var.disk_size
    encrypted   = true
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required" # IMDSv2
  }

  tags = { Name = var.name }

  lifecycle {
    ignore_changes = [ami] # tránh recreate khi Canonical phát hành AMI mới
  }
}

# Elastic IP (tuỳ chọn) để IP không đổi khi stop/start
resource "aws_eip" "this" {
  count = var.allocate_elastic_ip ? 1 : 0

  domain   = "vpc"
  instance = aws_instance.this.id

  tags = { Name = "${var.name}-eip" }
}
