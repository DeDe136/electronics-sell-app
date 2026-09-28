# ── Môi trường DEV ─────────────────────────────────────────────────────
# ĐỔI 2 giá trị placeholder ở đầu file (email, IP) trước khi apply.
alarm_email_addresses = ["you@example.com"]  # TODO: email nhận cảnh báo
admin_ssh_cidrs       = ["<your-public-ip>/32"]  # TODO: IP public của bạn (https://checkip.amazonaws.com)

environment = "dev"
region      = "ap-southeast-1"
name_prefix = "techshop-dev"
domain_name = "techshop-dev.dynv6.net"

vpc_cidr       = "10.10.0.0/16"
s3_bucket_name = "techshop-dev-images-bk" # phải duy nhất toàn cầu

cluster_log_retention_days = 14
db_backup_retention_days   = 1

# Dev dễ dọn dẹp: không chặn xoá DB, không chụp snapshot cuối
db_deletion_protection = false
db_skip_final_snapshot = true
s3_force_destroy       = true
