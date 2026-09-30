output "vpc_id" {
  value = aws_vpc.this.id
}

output "vpc_cidr" {
  value = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet theo thứ tự AZ 1, AZ 2."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet theo thứ tự AZ 1, AZ 2."
  value       = aws_subnet.private[*].id
}

output "nat_gateway_public_ips" {
  description = "IP public của các NAT gateway (1 per AZ)."
  value       = aws_eip.nat[*].public_ip
}
