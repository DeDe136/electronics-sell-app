#!/usr/bin/env bash
# Wrapper chạy Terraform theo môi trường: tự init đúng backend + tự thêm -var-file.
#
# Dùng:  bash scripts/tf.sh <dev|test|prod> <lệnh terraform> [tham số...]
# Ví dụ: bash scripts/tf.sh dev plan
#        bash scripts/tf.sh prod apply
#        bash scripts/tf.sh prod output -raw argocd_application_values
#        bash scripts/tf.sh dev validate
set -euo pipefail

ENV_NAME="${1:-}"
CMD="${2:-}"
if [ -z "$ENV_NAME" ] || [ -z "$CMD" ]; then
  echo "Cách dùng: $0 <dev|test|prod> <lệnh terraform> [tham số...]" >&2
  exit 1
fi
shift 2

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_DIR="$ROOT_DIR/env/$ENV_NAME"
if [ ! -d "$ENV_DIR" ]; then
  echo "Không có môi trường '$ENV_NAME' (thư mục $ENV_DIR)." >&2
  exit 1
fi

cd "$ROOT_DIR"

case "$CMD" in
  fmt)
    exec terraform fmt -recursive "$@"
    ;;
  validate)
    terraform init -backend=false -input=false >/dev/null
    exec terraform validate "$@"
    ;;
esac

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${STATE_BUCKET:-techshop-tfstate-${ACCOUNT_ID}}"

# -reconfigure: đổi qua lại giữa các môi trường không bị lẫn state
terraform init -reconfigure -input=false \
  -backend-config="$ENV_DIR/backend.hcl" \
  -backend-config="bucket=$BUCKET"

case "$CMD" in
  plan|apply|destroy|refresh|import|console)
    VAR_FILES=(-var-file="$ENV_DIR/terraform.tfvars")

    # Giá trị cá nhân (email, IP SSH): nạp từ secrets.tfvars khi chạy local.
    # Trên CI không có file này — truyền qua TF_VAR_alarm_email_addresses / TF_VAR_admin_ssh_cidrs.
    if [ -f "$ENV_DIR/secrets.tfvars" ]; then
      VAR_FILES+=(-var-file="$ENV_DIR/secrets.tfvars")
    fi

    exec terraform "$CMD" "${VAR_FILES[@]}" "$@"
    ;;
  *)
    exec terraform "$CMD" "$@"
    ;;
esac
