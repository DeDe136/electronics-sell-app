# Backend S3 khai báo dạng "partial configuration": phần còn lại (key, region,
# bucket...) được truyền lúc init — xem env/<env>/backend.hcl và scripts/tf.sh.
# Tạo bucket lưu state lần đầu bằng: scripts/bootstrap-tfstate.sh
terraform {
  backend "s3" {}
}
