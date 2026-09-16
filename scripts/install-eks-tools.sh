#!/bin/bash
# Cài đặt các tool nền tảng lên cụm EKS: AWS Load Balancer Controller, EBS CSI
# Driver, kube-prometheus-stack, KEDA, Argo Rollouts, ArgoCD (ArgoCD cài SAU
# CÙNG).
#
# Chart helm/electronics-shop-eks khai báo Ingress (className: alb — cần AWS
# LB Controller), Rollout (CRD của Argo Rollouts), ScaledObject (CRD của
# KEDA), lấy metrics từ Prometheus (kube-prometheus-stack) — thiếu bất kỳ
# tool nào trong 6 tool này, app sẽ báo lỗi thiếu CRD/StorageClass hoặc pod
# đứng yên không chạy được.
#
# CỐ Ý KHÔNG tạo IAM Policy/Role bằng AWS CLI trong script này — 2 role dưới
# đây (ALB Controller, EBS CSI Driver) PHẢI tạo tay qua console TRƯỚC,
# vì sau này khi đưa Terraform vào, các tài nguyên IAM này sẽ do Terraform
# quản lý — tạo bằng CLI rải rác trong script ngay từ bây giờ sẽ gây xung
# đột state với Terraform sau này (Terraform không biết resource đã tồn tại
# ngoài ý nó, dễ dính lỗi "already exists" hoặc phải import tay).
#
# ĐIỀU KIỆN CẦN TRƯỚC KHI CHẠY:
#   - kubectl đã trỏ đúng context EKS (kubectl config current-context)
#   - Đã tạo tay 2 IAM Role qua console: techshop-alb-controller-role,
#     techshop-ebs-csi-role — script sẽ hỏi ARN của 2 role này khi chạy,
#     không cần sửa file.
#   - Namespace "electronics-shop" đã tồn tại
#   - Đã điền giá trị domain thật trong các field ingress.hosts/hostname của các file
#     argo/argocd-server-values-eks.yaml, argo/argo-rollouts-values-eks.yaml và
#     monitoring/kube-prometheus-stack-values-eks-example.yaml
#
# Chạy từ root project: bash scripts/install-eks-tools.sh

set -e

# ────────────────────────────────────────────────────────────────────────
# NHẬP GIÁ TRỊ THẬT KHI SCRIPT CHẠY (không viết cứng vào file)
# ────────────────────────────────────────────────────────────────────────
read -r -p "Cluster name [techshop-cluster]: " CLUSTER_NAME
CLUSTER_NAME="${CLUSTER_NAME:-techshop-cluster}"

read -r -p "AWS region [ap-southeast-1]: " AWS_REGION
AWS_REGION="${AWS_REGION:-ap-southeast-1}"

# Gợi ý lấy VPC_ID nếu chưa nhớ: aws eks describe-cluster --name "$CLUSTER_NAME" \
#   --query "cluster.resourcesVpcConfig.vpcId" --output text
read -r -p "VPC ID: " VPC_ID
while [ -z "$VPC_ID" ]; do
  read -r -p "VPC ID (bắt buộc, không được để trống): " VPC_ID
done

read -r -p "ARN role IAM của AWS Load Balancer Controller (techshop-alb-controller-role): " ALB_CONTROLLER_ROLE_ARN
while [ -z "$ALB_CONTROLLER_ROLE_ARN" ]; do
  read -r -p "ARN role ALB Controller (bắt buộc, không được để trống): " ALB_CONTROLLER_ROLE_ARN
done

read -r -p "ARN role IAM của EBS CSI Driver (techshop-ebs-csi-role): " EBS_CSI_ROLE_ARN
while [ -z "$EBS_CSI_ROLE_ARN" ]; do
  read -r -p "ARN role EBS CSI Driver (bắt buộc, không được để trống): " EBS_CSI_ROLE_ARN
done
# ────────────────────────────────────────────────────────────────────────

echo "=== 0. Thêm các Helm repo cần dùng ==="
helm repo add eks https://aws.github.io/eks-charts
helm repo add aws-ebs-csi-driver https://kubernetes-sigs.github.io/aws-ebs-csi-driver
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add kedacore https://kedacore.github.io/charts
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

# ── Helper: tạo namespace nếu chưa có (idempotent, chạy lại script không lỗi) ──
create_namespace_if_missing() {
  kubectl get namespace "$1" >/dev/null 2>&1 || kubectl create namespace "$1"
}

# ── Helper: tạo + annotate ServiceAccount cho IRSA (idempotent) ──
# CHỈ tạo K8s ServiceAccount (tài nguyên trong cluster) — KHÔNG đụng gì tới
# IAM Role/Policy (tài nguyên AWS, đã tạo tay ngoài script, xem đầu file).
create_irsa_serviceaccount() {
  local sa_name="$1" ns="$2" role_arn="$3"
  if kubectl get serviceaccount "$sa_name" -n "$ns" >/dev/null 2>&1; then
    echo "ServiceAccount $sa_name (namespace $ns) đã tồn tại, chỉ cập nhật annotation."
  else
    kubectl create serviceaccount "$sa_name" -n "$ns"
  fi
  kubectl annotate serviceaccount "$sa_name" -n "$ns" \
    eks.amazonaws.com/role-arn="$role_arn" --overwrite
}

echo ""
echo "=== 1. Cài AWS Load Balancer Controller ==="
create_irsa_serviceaccount aws-load-balancer-controller kube-system "$ALB_CONTROLLER_ROLE_ARN"
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName="$CLUSTER_NAME" \
  --set region="$AWS_REGION" \
  --set vpcId="$VPC_ID" \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller

echo ""
echo "=== 2. Cài EBS CSI Driver + tạo StorageClass gp3 ==="
create_irsa_serviceaccount ebs-csi-controller-sa kube-system "$EBS_CSI_ROLE_ARN"
helm install aws-ebs-csi-driver aws-ebs-csi-driver/aws-ebs-csi-driver \
  -n kube-system \
  --set controller.serviceAccount.create=false \
  --set controller.serviceAccount.name=ebs-csi-controller-sa
# Add-on chỉ cài driver, KHÔNG tự tạo StorageClass tên "gp3" — cần apply tay
# (monitoring/kube-prometheus-stack-values-eks.yaml ở mục 3 dưới đây cần
# đúng StorageClass tên này).
kubectl apply -f - <<'EOF'
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
volumeBindingMode: WaitForFirstConsumer
EOF

echo ""
echo "=================================================================="
echo "  DỪNG LẠI — cần làm tay trước khi script tiếp tục:"
echo ""
echo "  cp monitoring/kube-prometheus-stack-values-eks-example.yaml \\"
echo "     monitoring/kube-prometheus-stack-values-eks.yaml"
echo ""
echo "  Mở file monitoring/kube-prometheus-stack-values-eks.yaml (không phải"
echo "  bản -example) vừa tạo, điền giá trị thật vào các chỗ đang để"
echo "  REPLACE_ME/changeme, gồm:"
echo "     - grafana.adminPassword"
echo "     - alertmanager.config.global.smtp_from / smtp_auth_username (Gmail dùng để gửi)"
echo "     - alertmanager.config.receivers[0].email_configs[0].to (email nhận cảnh báo)"
echo "  File này đã có sẵn trong .gitignore — điền giá trị thật KHÔNG sợ bị"
echo "  commit nhầm lên Git."
echo "=================================================================="
read -r -p "Điền xong file trên rồi, nhấn Enter để tiếp tục... " _

echo ""
echo "=== 3. Cài kube-prometheus-stack (Prometheus + Alertmanager + Grafana) ==="
create_namespace_if_missing monitoring

# Secret chứa Gmail App Password cho Alertmanager — PHẢI tạo TRƯỚC khi cài,
# vì file values ở trên có mount
# "alertmanagerSpec.secrets: [alertmanager-gmail-credentials]" — thiếu
# secret này Alertmanager pod sẽ không khởi động được.
# Không đưa App Password vào bất kỳ file values nào (kể cả bản gitignore) —
# nhạy cảm hơn cả các secret khác vì gắn với tài khoản Gmail cá nhân.
if kubectl get secret alertmanager-gmail-credentials -n monitoring >/dev/null 2>&1; then
  echo "Secret alertmanager-gmail-credentials đã tồn tại, bỏ qua."
else
  read -r -s -p "Dán Gmail App Password (16 ký tự, ẩn khi gõ): " GMAIL_APP_PASSWORD
  echo ""
  kubectl create secret generic alertmanager-gmail-credentials \
    -n monitoring \
    --from-literal=password="$GMAIL_APP_PASSWORD"
  unset GMAIL_APP_PASSWORD
fi

helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  -f monitoring/kube-prometheus-stack-values-eks.yaml

echo ""
echo "=== 4. Cài KEDA (CRD ScaledObject dùng trong chart electronics-shop-eks) ==="
create_namespace_if_missing keda
# Dùng thẳng keda/keda-values.yaml — không cần bản "-eks" riêng, vì KEDA chỉ
# gọi vào Prometheus qua Service nội bộ namespace "monitoring", không phụ
# thuộc gì vào Traefik/local-path như phần Ingress ở các chart khác.
helm install keda kedacore/keda \
  --namespace keda \
  -f keda/keda-values.yaml

echo ""
echo "=== 5. Cài Argo Rollouts (controller + CRD Rollout) ==="
create_namespace_if_missing argo-rollouts
helm install argo-rollouts argo/argo-rollouts \
  --namespace argo-rollouts
# Upgrade để bật Dashboard chạy thường trực + Ingress — xem
# argo/argo-rollouts-values-eks.yaml.
helm upgrade argo-rollouts argo/argo-rollouts \
  -n argo-rollouts \
  -f argo/argo-rollouts-values-eks.yaml

echo ""
echo "=== 6. Cài Argo CD (CÀI SAU CÙNG) ==="
# ArgoCD cố ý cài SAU CÙNG, không phải đầu script: Application của ArgoCD
# (mục apply ở dưới) sync thẳng chart electronics-shop-eks vào cluster —
# chart này có object thuộc CRD của Argo Rollouts (Rollout) và KEDA
# (ScaledObject), và Ingress cần AWS LB Controller đã chạy để tạo ALB. Nếu
# cài ArgoCD trước rồi apply Application ngay, Argo CD sẽ cố sync các object
# đó khi CRD/controller tương ứng CHƯA tồn tại trong cluster — sync thất bại
# ngay ("no matches for kind Rollout"/"ScaledObject"...), phải Sync lại tay
# sau khi cài đủ mới hết lỗi. Cài đủ 5 mục ở trên trước sẽ tránh hẳn lỗi này.
create_namespace_if_missing argocd
helm install argocd argo/argo-cd -n argocd
helm upgrade argocd argo/argo-cd -n argocd -f argo/argocd-server-values-eks.yaml

echo ""
echo "=================================================================="
echo "  DỪNG LẠI — cần làm tay trước khi script tiếp tục:"
echo ""
echo "  1) cp argo/argocd-application-eks.example.yaml argo/argocd-application-eks.yaml"
echo "     cp argo/argocd-repo-secret.example.yaml       argo/argocd-repo-secret.yaml"
echo "  2) Mở 2 file *.yaml (không phải *.example.yaml) vừa tạo, điền đúng:"
echo "     - URL/branch repo Git thật của bạn"
echo "     - Toàn bộ giá trị AWS thật trong valuesObject (rds.host, s3.bucket,"
echo "       s3.region, secretsManager.dbSecretArn, serviceAccount.*.roleArn,"
echo "       ingress.host, harborAuth...) — file này thay cho \"-f values-eks.yaml\""
echo "       khi deploy qua Argo CD (GitOps), không dùng \"-f\" như helm CLI tay"
echo "     - Credential Git thật (nếu repo private) trong argocd-repo-secret.yaml"
echo "  2 file này đã có sẵn trong .gitignore — điền giá trị thật KHÔNG sợ"
echo "  bị commit nhầm lên Git."
echo "=================================================================="
read -r -p "Điền xong 2 file trên rồi, nhấn Enter để tiếp tục... " _

echo ""
echo "=== 7. Apply Argo CD Application + repo secret vào cluster ==="
kubectl apply -f argo/argocd-repo-secret.yaml
kubectl apply -f argo/argocd-application-eks.yaml

echo ""
echo "=== XONG. Kiểm tra nhanh ==="
echo "kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller"
echo "kubectl get pods -n kube-system -l app=ebs-csi-controller"
echo "kubectl get storageclass gp3"
echo "kubectl get pods -n monitoring"
echo "kubectl get pods -n keda"
echo "kubectl get pods -n argo-rollouts"
echo "kubectl get pods -n argocd"
echo ""
echo "App được Argo CD tự động deploy qua Application vừa apply — KHÔNG cần"
echo "chạy tay \"helm install/upgrade\" cho electronics-shop-eks nữa. Theo dõi"
echo "tiến trình sync bằng:"
echo "  kubectl get application electronics-shop -n argocd"
echo "hoặc mở UI Argo CD (xem argo/argocd-server-values-eks.yaml để lấy đúng"
echo "domain Ingress đã cấu hình)."