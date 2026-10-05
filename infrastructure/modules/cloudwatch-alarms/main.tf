############################################
# CloudWatch alarm cho LOG control plane của EKS → SNS → email
#
# Prometheus đã giám sát workload/node nhưng KHÔNG scrape được control plane
# (EKS chạy nó ngoài account của bạn — kubeScheduler/kubeControllerManager/
# kubeEtcd đều đã tắt trong values kube-prometheus-stack). Vì vậy các alarm ở
# đây chỉ bám vào log control plane, không đụng metric CPU/memory/pod.
############################################
locals {
  metric_namespace = "${var.name_prefix}/EKSControlPlane"

  log_alarms = {
    api_server_5xx = {
      description = "kube-apiserver trả lỗi 5xx (audit log) — control plane có vấn đề"
      pattern     = "{ $.responseStatus.code >= 500 }"
      threshold   = var.thresholds.api_server_5xx
    }
    api_server_throttled = {
      description = "kube-apiserver trả 429 Too Many Requests (bị throttle bởi API Priority & Fairness)"
      pattern     = "{ $.responseStatus.code = 429 }"
      threshold   = var.thresholds.api_server_throttled
    }
    api_unauthorized = {
      description = "Nhiều request bị 401/403 tới API server — có thể sai RBAC hoặc bị dò quét"
      pattern     = "{ ($.responseStatus.code = 401) || ($.responseStatus.code = 403) }"
      threshold   = var.thresholds.api_unauthorized
    }
    authenticator_denied = {
      description = "aws-iam-authenticator từ chối truy cập (sai IAM principal / node không join được cluster)"
      pattern     = "\"access denied\""
      threshold   = var.thresholds.authenticator_denied
    }
    control_plane_errors = {
      description = "Số dòng log mức Error (klog 'E....') của control plane tăng bất thường"
      pattern     = "%^E[0-9]{4} %"
      threshold   = var.thresholds.control_plane_errors
    }
    leader_election_lost = {
      description = "controller-manager / scheduler mất leader election"
      pattern     = "\"leaderelection lost\""
      threshold   = 1
    }
  }
}

# ── KMS CMK mã hoá SNS topic ──────────────────────────────────────────────
# CloudWatch Alarm KHÔNG publish được vào topic mã hoá bằng khoá AWS managed "alias/aws/sns": policy
# của khoá đó không cho phép cloudwatch.amazonaws.com gọi kms:Decrypt/kms:GenerateDataKey và cũng không
# sửa được (alarm báo "CloudWatch Alarms does not have authorization to access the SNS topic encryption
# key" và email không bao giờ được gửi). Vì vậy phải dùng CMK tự quản kèm key policy dưới đây.
# Checkov: CKV_AWS_109, CKV_AWS_111, CKV_AWS_356 — skip.
data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "sns_kms" {
  # Mẫu chuẩn AWS cho mọi key policy: root của account được toàn quyền, "*" chỉ trỏ tới chính key này.
  statement {
    sid     = "EnableIAMUserPermissions"
    actions = ["kms:*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    resources = ["*"]
  }

  # Quyền AWS yêu cầu để CloudWatch alarm publish được vào SNS topic mã hoá bằng CMK.
  statement {
    sid     = "AllowCloudWatchAlarmsToUseKey"
    actions = ["kms:Decrypt", "kms:GenerateDataKey*", "kms:DescribeKey"]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }
    resources = ["*"]
  }
}

resource "aws_kms_key" "sns" {
  description         = "${var.name_prefix} SNS topic cảnh báo EKS control plane (CloudWatch Alarm -> SNS)"
  enable_key_rotation = true
  policy              = data.aws_iam_policy_document.sns_kms.json
}

resource "aws_kms_alias" "sns" {
  name          = "alias/${var.name_prefix}-sns-alarms"
  target_key_id = aws_kms_key.sns.key_id
}

resource "aws_sns_topic" "this" {
  name              = "${var.name_prefix}-eks-control-plane-alarms"
  kms_master_key_id = aws_kms_key.sns.arn
}

resource "aws_sns_topic_subscription" "email" {
  for_each = toset(var.alarm_email_addresses)

  topic_arn = aws_sns_topic.this.arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_cloudwatch_log_metric_filter" "this" {
  for_each = local.log_alarms

  name           = "${var.cluster_name}-${each.key}"
  log_group_name = var.log_group_name
  pattern        = each.value.pattern

  metric_transformation {
    name          = each.key
    namespace     = local.metric_namespace
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "this" {
  for_each = local.log_alarms

  alarm_name          = "${var.cluster_name}-${each.key}"
  alarm_description   = each.value.description
  namespace           = local.metric_namespace
  metric_name         = aws_cloudwatch_log_metric_filter.this[each.key].metric_transformation[0].name
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = each.value.threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.this.arn]
  ok_actions    = [aws_sns_topic.this.arn]
}
