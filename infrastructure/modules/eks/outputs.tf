output "cluster_name" {
  value = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  value = aws_eks_cluster.this.endpoint
}

output "cluster_security_group_id" {
  description = "Cluster security group tự sinh, gắn vào mọi worker node."
  value       = aws_eks_cluster.this.vpc_config[0].cluster_security_group_id
}

output "oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.this.arn
}

output "oidc_provider_host" {
  description = "Issuer URL bỏ tiền tố https:// (dùng trong điều kiện trust policy IRSA)."
  value       = replace(aws_iam_openid_connect_provider.this.url, "https://", "")
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.cluster.name
}

output "node_role_arn" {
  value = aws_iam_role.node.arn
}
