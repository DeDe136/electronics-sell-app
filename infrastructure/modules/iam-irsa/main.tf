############################################
# IAM policy cho app + IAM role IRSA (Web identity) trust theo đúng ServiceAccount:
#   backend        → electronics-shop/backend-sa
#   frontend       → electronics-shop/frontend-sa
#   alb_controller → kube-system/aws-load-balancer-controller
#   ebs_csi        → kube-system/ebs-csi-controller-sa
############################################

# ── Policy cho app ─────────────────────────────────────────────────────
resource "aws_iam_policy" "s3_backend" {
  name = "${var.name_prefix}-s3-backend-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${var.s3_bucket_arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = var.s3_bucket_arn
      }
    ]
  })
}

resource "aws_iam_policy" "secrets_manager" {
  name = "${var.name_prefix}-secrets-manager-policy"

  # Thu hẹp đúng secret master credentials của RDS này (tài liệu dùng wildcard rds!db-*).
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = var.db_secret_arn
      }
    ]
  })
}

resource "aws_iam_policy" "s3_frontend_read" {
  name = "${var.name_prefix}-s3-frontend-read-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = "${var.s3_bucket_arn}/*"
      }
    ]
  })
}

# Policy của AWS Load Balancer Controller (file JSON từ kubernetes-sigs/aws-load-balancer-controller)
resource "aws_iam_policy" "alb_controller" {
  name   = "${var.name_prefix}-alb-controller-policy"
  policy = file("${path.module}/policies/aws-load-balancer-controller-iam-policy.json")
}

# ── Role IRSA ──────────────────────────────────────────────────────────
locals {
  irsa_roles = {
    backend = {
      name      = "${var.name_prefix}-backend-irsa-role"
      namespace = var.app_namespace
      sa        = "backend-sa"
      policies = {
        s3_backend      = aws_iam_policy.s3_backend.arn
        secrets_manager = aws_iam_policy.secrets_manager.arn
      }
    }
    frontend = {
      name      = "${var.name_prefix}-frontend-irsa-role"
      namespace = var.app_namespace
      sa        = "frontend-sa"
      policies  = { s3_frontend_read = aws_iam_policy.s3_frontend_read.arn }
    }
    alb_controller = {
      name      = "${var.name_prefix}-alb-controller-role"
      namespace = "kube-system"
      sa        = "aws-load-balancer-controller"
      policies  = { alb_controller = aws_iam_policy.alb_controller.arn }
    }
    ebs_csi = {
      name      = "${var.name_prefix}-ebs-csi-role"
      namespace = "kube-system"
      sa        = "ebs-csi-controller-sa"
      policies  = { ebs_csi = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy" }
    }
  }

  # Key của for_each dùng tên tĩnh (ARN có thể chưa biết lúc plan)
  policy_attachments = merge([
    for role_key, role in local.irsa_roles : {
      for pkey, arn in role.policies : "${role_key}|${pkey}" => {
        role_key   = role_key
        policy_arn = arn
      }
    }
  ]...)
}

data "aws_iam_policy_document" "trust" {
  for_each = local.irsa_roles

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${var.oidc_provider_host}:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "${var.oidc_provider_host}:sub"
      values   = ["system:serviceaccount:${each.value.namespace}:${each.value.sa}"]
    }
  }
}

resource "aws_iam_role" "this" {
  for_each = local.irsa_roles

  name               = each.value.name
  assume_role_policy = data.aws_iam_policy_document.trust[each.key].json
}

resource "aws_iam_role_policy_attachment" "this" {
  for_each = local.policy_attachments

  role       = aws_iam_role.this[each.value.role_key].name
  policy_arn = each.value.policy_arn
}
