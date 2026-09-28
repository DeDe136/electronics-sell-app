# ── Môi trường PROD (tên tài nguyên khớp đúng docs/eks-manual-deployment-guide.md) ──
# ĐỔI 2 giá trị placeholder ở đầu file (email, IP) trước khi apply.
alarm_email_addresses = ["you@example.com"]  # TODO: email nhận cảnh báo
admin_ssh_cidrs       = ["<your-public-ip>/32"]  # TODO: IP public của bạn (https://checkip.amazonaws.com)

environment = "prod"
region      = "ap-southeast-1"
name_prefix = "techshop" # → techshop-cluster, techshop-postgres, techshop-backend-irsa-role...
domain_name = "techshop-tde.dynv6.net"

vpc_cidr       = "10.0.0.0/16"
s3_bucket_name = "techshop-images-bk" # phải duy nhất toàn cầu — đổi nếu bị trùng

cluster_log_retention_days = 90
db_backup_retention_days   = 7

# Prod: chống xoá nhầm DB, luôn chụp snapshot cuối khi destroy, không xoá bucket còn ảnh
db_deletion_protection = true
db_skip_final_snapshot = false
s3_force_destroy       = false

# IAM user/role khác (ngoài người chạy terraform) cần kubectl admin:
# cluster_admin_principal_arns = ["arn:aws:iam::123456789012:user/your-user"]
#
# Ghim phiên bản PostgreSQL nếu muốn (mặc định "18" = RDS tự chọn minor mới nhất):
# db_engine_version = "18.3"
