# Truyền vào: terraform init -backend-config=env/test/backend.hcl (scripts/tf.sh làm giúp,
# và tự thêm bucket=techshop-tfstate-<account-id>)
key          = "electronics-shop/test/terraform.tfstate"
region       = "ap-southeast-1"
encrypt      = true
use_lockfile = true
