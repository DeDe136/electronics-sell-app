############################################
# VPC & Subnet (tương đương "VPC and more" trên console)
# - 2 AZ, 2 public + 2 private subnet
# - NAT gateway: 1 PER AZ (mỗi AZ 1 NAT, KHÔNG dùng chung 1 NAT)
# - Không VPC endpoint
############################################
locals {
  az_count = length(var.availability_zones)

  # /16 -> /20: public = #0,#1 ; private = #8,#9  (10.0.0.0/20, 10.0.16.0/20, 10.0.128.0/20, 10.0.144.0/20)
  public_subnet_cidrs  = [for i in range(local.az_count) : cidrsubnet(var.vpc_cidr, 4, i)]
  private_subnet_cidrs = [for i in range(local.az_count) : cidrsubnet(var.vpc_cidr, 4, i + 8)]
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.name_prefix}-vpc" }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name_prefix}-igw" }
}

resource "aws_subnet" "public" {
  count = local.az_count

  vpc_id                  = aws_vpc.this.id
  cidr_block              = local.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name                     = "${var.name_prefix}-subnet-public${count.index + 1}-${var.availability_zones[count.index]}"
    "kubernetes.io/role/elb" = "1" # AWS Load Balancer Controller đặt ALB/NLB internet-facing vào đây
  }
}

resource "aws_subnet" "private" {
  count = local.az_count

  vpc_id            = aws_vpc.this.id
  cidr_block        = local.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name                              = "${var.name_prefix}-subnet-private${count.index + 1}-${var.availability_zones[count.index]}"
    "kubernetes.io/role/internal-elb" = "1"
  }
}

# ── NAT gateway: 1 per AZ ──────────────────────────────────────────────
resource "aws_eip" "nat" {
  count  = local.az_count
  domain = "vpc"

  tags = { Name = "${var.name_prefix}-eip-nat${count.index + 1}-${var.availability_zones[count.index]}" }
}

resource "aws_nat_gateway" "this" {
  count = local.az_count

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = { Name = "${var.name_prefix}-nat-public${count.index + 1}-${var.availability_zones[count.index]}" }

  depends_on = [aws_internet_gateway.this]
}

# ── Route table ────────────────────────────────────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name_prefix}-rtb-public" }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  count = local.az_count

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Mỗi private subnet có route table riêng, đi ra internet qua NAT cùng AZ
resource "aws_route_table" "private" {
  count = local.az_count

  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name_prefix}-rtb-private${count.index + 1}-${var.availability_zones[count.index]}" }
}

resource "aws_route" "private_nat" {
  count = local.az_count

  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[count.index].id
}

resource "aws_route_table_association" "private" {
  count = local.az_count

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ── Khoá default Security Group của VPC (không ai nên dùng nó) ─────────
resource "aws_default_security_group" "this" {
  vpc_id = aws_vpc.this.id
  # Cố tình để trống ingress/egress — không có rule nào nghĩa là chặn hết,
  # buộc mọi resource phải khai security group riêng (đúng như các module
  # ec2/eks/rds đã làm).
}

# ── VPC Flow Logs: ghi lại toàn bộ traffic ACCEPT/REJECT lên CloudWatch Logs ──
# Không mã hoá bằng CMK riêng (chỉ log metadata traffic, không nhạy cảm như
# Kubernetes Secrets) và retention < 1 năm theo biến flow_log_retention_days.
# Checkov: CKV_AWS_158, CKV_AWS_338 - skip.
resource "aws_cloudwatch_log_group" "flow_log" {
  name              = "/aws/vpc-flow-log/${var.name_prefix}"
  retention_in_days = var.flow_log_retention_days
}

data "aws_iam_policy_document" "flow_log_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "flow_log" {
  name               = "${var.name_prefix}-vpc-flow-log-role"
  assume_role_policy = data.aws_iam_policy_document.flow_log_assume.json
}

data "aws_iam_policy_document" "flow_log_permissions" {
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
    ]
    resources = ["${aws_cloudwatch_log_group.flow_log.arn}:*"]
  }
}

resource "aws_iam_role_policy" "flow_log" {
  name   = "${var.name_prefix}-vpc-flow-log-policy"
  role   = aws_iam_role.flow_log.id
  policy = data.aws_iam_policy_document.flow_log_permissions.json
}

resource "aws_flow_log" "this" {
  vpc_id               = aws_vpc.this.id
  traffic_type         = "ALL"
  log_destination_type = "cloud-watch-logs"
  log_destination      = aws_cloudwatch_log_group.flow_log.arn
  iam_role_arn         = aws_iam_role.flow_log.arn

  tags = { Name = "${var.name_prefix}-vpc-flow-log" }
}
