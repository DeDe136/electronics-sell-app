variable "name_prefix" {
  type = string
}

variable "oidc_provider_arn" {
  description = "ARN OIDC provider của cluster EKS."
  type        = string
}

variable "oidc_provider_host" {
  description = "Issuer URL của cluster, bỏ tiền tố https:// (oidc.eks.<region>.amazonaws.com/id/<ID>)."
  type        = string
}

variable "s3_bucket_arn" {
  type = string
}

variable "db_secret_arn" {
  description = "ARN secret master credentials của RDS trong Secrets Manager."
  type        = string
}

variable "app_namespace" {
  description = "Namespace Kubernetes của app (chứa backend-sa và frontend-sa)."
  type        = string
  default     = "electronics-shop"
}
