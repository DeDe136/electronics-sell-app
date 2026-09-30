output "endpoint" {
  description = "Hostname của RDS (không kèm port) → rds.host trong chart."
  value       = aws_db_instance.this.address
}

output "port" {
  value = aws_db_instance.this.port
}

output "master_secret_arn" {
  description = "ARN secret master credentials trong Secrets Manager."
  value       = aws_db_instance.this.master_user_secret[0].secret_arn
}

output "security_group_id" {
  value = aws_security_group.this.id
}
