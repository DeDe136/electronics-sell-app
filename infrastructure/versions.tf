terraform {
  required_version = ">= 1.10.0" # backend S3 use_lockfile cần >= 1.10

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}
