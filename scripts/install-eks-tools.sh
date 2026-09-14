#!/bin/bash
# Cài đặt các tool nền tảng lên cụm EKS: ArgoCD, Argo Rollouts, kube-prometheus-
# stack, KEDA. Chart helm/electronics-shop-eks khai báo Rollout (CRD của Argo
# Rollouts) và ScaledObject (CRD của KEDA), lấy metrics từ Prometheus (CRD
# ServiceMonitor/PrometheusRule của kube-prometheus-stack) — thiếu bất kỳ tool
# nào trong 4 tool này, "helm install electronics-shop-eks" sẽ báo lỗi thiếu
# CRD hoặc pod đứng yên không chạy được.
#
# ĐIỀU KIỆN CẦN TRƯỚC KHI CHẠY:
#   - kubectl đã trỏ đúng context EKS (kubectl config current-context)
#   - AWS Load Balancer Controller đã cài (Bước 9), EBS CSI Driver đã cài
#     (cần cho PVC của kube-prometheus-stack)
#   - Namespace "electronics-shop" đã tồn tại
#
# Chạy từ root project: bash scripts/install-eks-tools.sh

set -e

echo "=== 0. Thêm các Helm repo cần dùng ==="
helm repo add argo https://argoproj.github.io/argo-helm
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add kedacore https://kedacore.github.io/charts
helm repo update

# ── Helper: tạo namespace nếu chưa có (idempotent, chạy lại script không lỗi) ──
create_namespace_if_missing() {
  kubectl get namespace "$1" >/dev/null 2>&1 || kubectl create namespace "$1"
}

echo ""
echo "=== 1. Cài Argo CD ==="
create_namespace_if_missing argocd
# Cài trước bằng values mặc định của chart (chưa có Ingress) — đúng cách cài
# ban đầu trong docs/argocd-rolling-update-guide.md.
helm install argocd argo/argo-cd -n argocd
# Upgrade ngay sau đó để bật Ingress (ALB, domain dynv6) — xem
# argo/argocd-server-values-eks.yaml.
helm upgrade argocd argo/argo-cd -n argocd -f argo/argocd-server-values-eks.yaml

echo ""
echo "=================================================================="
echo "  DỪNG LẠI — cần làm tay trước khi script tiếp tục:"
echo ""
echo "  1) cp argo/argocd-application.example.yaml argo/argocd-application.yaml"
echo "     cp argo/argocd-repo-secret.example.yaml  argo/argocd-repo-secret.yaml"
echo "  2) Mở 2 file *.yaml (không phải *.example.yaml) vừa tạo, điền đúng:"
echo "     - URL/branch repo Git thật của bạn"
echo "     - Đường dẫn chart (helm/electronics-shop-eks)"
echo "     - Credential Git thật (nếu repo private) trong argocd-repo-secret.yaml"
echo "  2 file này đã có sẵn trong .gitignore — điền giá trị thật KHÔNG sợ"
echo "  bị commit nhầm lên Git."
echo "=================================================================="
read -r -p "Điền xong 2 file trên rồi, nhấn Enter để tiếp tục... " _

echo ""
echo "=== 2. Apply Argo CD Application + repo secret vào cluster ==="
kubectl apply -f argo/argocd-repo-secret.yaml
kubectl apply -f argo/argocd-application.yaml

echo ""
echo "=== 3. Cài Argo Rollouts (controller + CRD Rollout) ==="
create_namespace_if_missing argo-rollouts
helm install argo-rollouts argo/argo-rollouts \
  --namespace argo-rollouts
# Upgrade để bật Dashboard chạy thường trực + Ingress — xem
# argo/argo-rollouts-values-eks.yaml.
helm upgrade argo-rollouts argo/argo-rollouts \
  -n argo-rollouts \
  -f argo/argo-rollouts-values-eks.yaml

echo ""
echo "=== 4. Cài kube-prometheus-stack (Prometheus + Alertmanager + Grafana) ==="
create_namespace_if_missing monitoring

# Secret chứa Gmail App Password cho Alertmanager — PHẢI tạo TRƯỚC khi cài,
# vì monitoring/kube-prometheus-stack-values-eks.yaml có mount
# "alertmanagerSpec.secrets: [alertmanager-gmail-credentials]" (xem file đó
# + docs/prometheus-grafana-alertmanager-monitoring-guide.md mục 5) — thiếu
# secret này Alertmanager pod sẽ không khởi động được (thiếu volume).
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
echo "=== 5. Cài KEDA (CRD ScaledObject dùng trong chart electronics-shop-eks) ==="
create_namespace_if_missing keda
# Dùng thẳng keda/keda-values.yaml — không cần bản "-eks" riêng, vì KEDA chỉ
# gọi vào Prometheus qua Service nội bộ namespace "monitoring", không phụ
# thuộc gì vào Traefik/local-path như phần Ingress ở các chart khác.
helm install keda kedacore/keda \
  --namespace keda \
  -f keda/keda-values.yaml

echo ""
echo "=== XONG. Kiểm tra nhanh ==="
echo "kubectl get pods -n argocd"
echo "kubectl get pods -n argo-rollouts"
echo "kubectl get pods -n monitoring"
echo "kubectl get pods -n keda"
echo ""
echo "Sau khi cả 4 namespace trên đều Running, mới chạy tiếp:"
echo "  helm upgrade --install electronics-shop helm/electronics-shop-eks \\"
echo "    -n electronics-shop --create-namespace \\"
echo "    -f helm/electronics-shop-eks/values.yaml \\"
echo "    -f helm/electronics-shop-eks/values-eks.yaml"