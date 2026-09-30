# ── Môi trường TEST ────────────────────────────────────────────────────
# Email nhận cảnh báo và IP SSH KHÔNG nằm ở đây — xem env/test/secrets.tfvars.example.

environment = "test"
region      = "ap-southeast-1"
name_prefix = "techshop-test"
domain_name = "techshop-test.dynv6.net"

vpc_cidr       = "10.20.0.0/16"
s3_bucket_name = "techshop-test-images-bk" # phải duy nhất toàn cầu

cluster_log_retention_days = 30
db_backup_retention_days   = 3

db_deletion_protection = false
db_skip_final_snapshot = true
s3_force_destroy       = true
