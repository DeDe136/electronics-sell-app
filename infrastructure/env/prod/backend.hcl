# Truyền vào: terraform init -backend-config=env/prod/backend.hcl (scripts/tf.sh làm giúp,
# và tự thêm bucket=techshop-tfstate-<account-id>)
key          = "electronics-shop/prod/terraform.tfstate"
region       = "ap-southeast-1"
encrypt      = true
use_lockfile = true
