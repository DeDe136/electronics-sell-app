provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "electronics-shop"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
