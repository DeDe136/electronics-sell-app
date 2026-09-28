# ── Môi trường TEST ────────────────────────────────────────────────────
# ĐỔI 2 giá trị placeholder ở đầu file (email, IP) trước khi apply.
alarm_email_addresses = ["you@example.com"]  # TODO: email nhận cảnh báo
admin_ssh_cidrs       = ["<your-public-ip>/32"]  # TODO: IP public của bạn (https://checkip.amazonaws.com)

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
