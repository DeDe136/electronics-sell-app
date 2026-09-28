output "instance_id" {
  value = aws_instance.this.id
}

output "public_ip" {
  description = "Elastic IP nếu có, ngược lại là public IP tự cấp."
  value       = var.allocate_elastic_ip ? aws_eip.this[0].public_ip : aws_instance.this.public_ip
}

output "private_ip" {
  value = aws_instance.this.private_ip
}

output "security_group_id" {
  value = aws_security_group.this.id
}
