output "backend_role_arn" {
  description = "→ serviceAccount.backend.roleArn"
  value       = aws_iam_role.this["backend"].arn
}

output "frontend_role_arn" {
  description = "→ serviceAccount.frontend.roleArn"
  value       = aws_iam_role.this["frontend"].arn
}

output "alb_controller_role_arn" {
  value = aws_iam_role.this["alb_controller"].arn
}

output "ebs_csi_role_arn" {
  value = aws_iam_role.this["ebs_csi"].arn
}
