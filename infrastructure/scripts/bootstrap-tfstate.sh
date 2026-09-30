#!/usr/bin/env bash
# Tạo S3 bucket lưu Terraform state (chạy 1 LẦN duy nhất cho cả 3 môi trường —
# mỗi môi trường có key riêng trong bucket, xem env/<env>/backend.hcl).
#
# Dùng:  bash scripts/bootstrap-tfstate.sh
# Tuỳ chọn: AWS_REGION (mặc định ap-southeast-1), STATE_BUCKET (mặc định
# techshop-tfstate-<account-id>) — scripts/tf.sh dùng cùng quy tắc đặt tên này.
set -euo pipefail

REGION="${AWS_REGION:-ap-southeast-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${STATE_BUCKET:-techshop-tfstate-${ACCOUNT_ID}}"

if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "Bucket $BUCKET đã tồn tại — bỏ qua bước tạo."
else
  echo "Tạo bucket $BUCKET ($REGION)..."
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
fi

aws s3api put-bucket-versioning --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "Xong. State bucket: $BUCKET"
