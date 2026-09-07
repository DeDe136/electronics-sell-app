# Hướng dẫn: Cài Prometheus + Grafana + Alertmanager, giám sát backend/frontend qua Dashboard-as-Code

File này ghi lại toàn bộ quá trình cài `kube-prometheus-stack` (Prometheus +
Grafana + Alertmanager) vào cluster K3s local, cấu hình cảnh báo qua email,
và thiết lập giám sát backend/frontend theo hướng **dashboard-as-code**
(dashboard nạp tự động từ Git qua ConfigMap, không import tay qua UI).

Yêu cầu trước khi làm theo file này: đã hoàn thành
`argo-rollouts-canary-guide.md` (Argo CD + Argo Rollouts canary chạy ổn
định trên chart `helm/electronics-shop-rollout`).

## 0. Vị trí đặt file trong project

```
electronics-sell-app-thanhde/
├── monitoring/
│   ├── kube-prometheus-stack-values-example.yaml   # mẫu, COMMIT lên Git
│   └── kube-prometheus-stack-values.yaml           # giá trị thật, GITIGNORE
├── docs/
│   └── prometheus-grafana-monitoring-guide.md      # file này
├── helm/
│   ├── electronics-shop/                # chart gốc — GIỮ NGUYÊN
│   ├── electronics-shop-rollout/        # chart Rollout canary — GIỮ NGUYÊN
│   └── electronics-shop-monitoring/     # chart mới: Rollout + PodMonitor + dashboard-as-code
│       ├── templates/
│       │   ├── backend-podmonitor.yaml
│       │   ├── frontend-podmonitor.yaml
│       │   ├── backend-grafana-dashboard.yaml
│       │   └── frontend-grafana-dashboard.yaml
│       └── dashboards/
│           ├── backend-dashboard.json
│           └── frontend-dashboard.json
```

Backend (NestJS) expose metrics ở `/metrics`, frontend (Next.js) expose ở
`/api/metrics` — cả 2 dùng `prom-client`, đã cài đặt sẵn từ trước (xem code
trong `backend/src/modules/metrics/` và `frontend/lib/metrics.ts`). File
này chỉ tập trung vào phần hạ tầng (Helm/Kubernetes/Grafana), không nhắc
lại phần code app.

---

## 1. Cài `kube-prometheus-stack`

### 1.1. Thêm Helm repo + namespace riêng

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

kubectl create namespace monitoring
```

Dùng namespace riêng `monitoring` (không chung `electronics-shop`) — đây là
hạ tầng giám sát toàn cluster, không phải app.

### 1.2. Tạo file values — tách example/thật (giống convention `values-dev-example.yaml`)

`monitoring/kube-prometheus-stack-values-example.yaml` (commit lên Git):

```yaml
# --- Tắt các control-plane component chỉ bind 127.0.0.1 trên K3s (kể cả
# kube-proxy — đây là default của CHÍNH kube-proxy trên mọi bản Kubernetes,
# không riêng do K3s gộp process), Prometheus không có cách nào scrape tới
# vì đứng trong Pod, network namespace riêng ---
kubeControllerManager:
  enabled: false
kubeScheduler:
  enabled: false
kubeEtcd:
  enabled: false
kubeProxy:
  enabled: false

prometheus:
  prometheusSpec:
    retention: 7d
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: local-path
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 10Gi
    resources:
      requests: { cpu: 200m, memory: 512Mi }
      limits: { cpu: 500m, memory: 1Gi }
  ingress:
    enabled: true
    ingressClassName: traefik
    hosts:
      - prometheus.techshop.local
    paths: ["/"]

alertmanager:
  alertmanagerSpec:
    storage:
      volumeClaimTemplate:
        spec:
          storageClassName: local-path
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 2Gi
  ingress:
    enabled: true
    ingressClassName: traefik
    hosts:
      - alertmanager.techshop.local
    paths: ["/"]

grafana:
  adminPassword: "<grafana-admin-password>"   # điền giá trị thật trong file values thật (GITIGNORE)
  persistence:
    enabled: true
    storageClassName: local-path
    size: 2Gi
  ingress:
    enabled: true
    ingressClassName: traefik
    hosts:
      - grafana.techshop.local
    path: /
  resources:
    # 256Mi KHÔNG đủ cho Grafana 13.x (tầng "unified storage" dùng Bleve
    # đánh index tốn thêm RAM đáng kể so với bản cũ) — Pod sẽ bị
    # OOMKilled (exit code 137) liên tục nếu để thấp hơn mức này.
    requests: { cpu: 100m, memory: 256Mi }
    limits: { cpu: 500m, memory: 512Mi }
```

Copy ra file thật, điền giá trị thật (`adminPassword` trong Grafana):

```bash
cp monitoring/kube-prometheus-stack-values-example.yaml monitoring/kube-prometheus-stack-values.yaml
```

Thêm vào `.gitignore`:
```
monitoring/kube-prometheus-stack-values.yaml
```

### 1.3. Cài đặt

```bash
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  -f monitoring/kube-prometheus-stack-values.yaml
```

### 1.4. Kiểm tra

```bash
kubectl get pods -n monitoring
kubectl get pvc -n monitoring       # 3 PVC (prometheus/alertmanager/grafana) đều Bound
kubectl get ingress -n monitoring   # 3 ingress đều có ADDRESS
```

---

## 2. Sửa lỗi `node-exporter` trên WSL2

Triệu chứng: Pod `kube-prometheus-stack-prometheus-node-exporter-xxxxx` kẹt
ở `CreateContainerError`, log Event báo:
```
Error: failed to generate container ... spec: path "/" is mounted on "/" but it is not a shared or slave mount
```

Nguyên nhân: `node-exporter` cần mount `/` của host với mount propagation
`rslave`, nhưng WSL2 mặc định mount `/` ở chế độ `private`. Đây là hạn chế
đã biết của WSL2, không phải lỗi cấu hình.

**Sửa tạm (áp dụng ngay):**
```bash
sudo mount --make-rshared /
```

**Sửa vĩnh viễn** (vì `wsl --shutdown` sẽ reset lại `private`):
```bash
sudo tee -a /etc/wsl.conf <<'EOF'

[boot]
command = mount --make-rshared /
EOF
```

Kiểm tra:
```bash
kubectl get pods -n monitoring -w   # node-exporter chuyển sang 1/1 Running
```

---

## 3. Trỏ domain + mở thử Prometheus/Grafana/Alertmanager UI

Lấy IP Traefik:
```bash
kubectl get svc -n kube-system traefik
```

Windows (`C:\Windows\System32\drivers\etc\hosts`, Notepad quyền Admin):
```
<Traefik-EXTERNAL-IP>   ... grafana.techshop.local prometheus.techshop.local alertmanager.techshop.local
```
```powershell
ipconfig /flushdns
```

WSL2 (`/etc/hosts`):
```bash
echo "127.0.0.1  grafana.techshop.local prometheus.techshop.local alertmanager.techshop.local" | sudo tee -a /etc/hosts
```

Test nhanh bằng `curl` trước khi mở trình duyệt:
```bash
curl -I http://prometheus.techshop.local
curl -I http://grafana.techshop.local
curl -I http://alertmanager.techshop.local
```

Mở trình duyệt:
- `http://prometheus.techshop.local` → **Status → Targets**, xác nhận mọi
  target đang `UP`.
- `http://alertmanager.techshop.local` → trống là bình thường (chưa cấu
  hình xong SMTP, chưa có alert nào firing).
- `http://grafana.techshop.local` → login `admin` / password đã điền ở
  mục 1.2 → **Connections → Data sources** → xác nhận đã có sẵn datasource
  `Prometheus`, bấm **Test** để chắc chắn kết nối OK.

---

## 4. Tách PodMonitor + Dashboard-as-code sang chart riêng

Chart `electronics-shop-rollout` được viết theo `argo-rollouts-canary-guide.md`
**trước khi** cài Prometheus/Grafana — để tài liệu đó luôn khớp đúng trạng
thái chart tại thời điểm nó mô tả, mọi resource liên quan giám sát
(PodMonitor, dashboard ConfigMap) được tách sang 1 chart mới, theo đúng mô
hình "copy chart + đổi path Argo CD" đã dùng ở Mục 0/8 của tài liệu đó.

### 4.1. Copy chart (bỏ qua bước này vì project đã thực hiện rồi)

```bash
cp -r helm/electronics-shop-rollout helm/electronics-shop-monitoring
```

Sửa `helm/electronics-shop-monitoring/Chart.yaml`:
```yaml
name: electronics-shop-monitoring
description: TechShop (Rollout canary) + Prometheus PodMonitor + Grafana dashboard-as-code
```

*(An toàn — không có template nào dùng `.Chart.Name` để đặt tên resource,
đổi tên chỉ ảnh hưởng metadata, không đổi tên Service/Deployment thật.)*

### 4.2. Đổi biến CI/CD

GitHub repo → **Settings → Secrets and variables → Actions → Variables**,
sửa `HELM_VALUES_FILE`:
```
helm/electronics-shop-monitoring/values.yaml
```

### 4.3. Test CI/CD ghi đúng tag vào chart mới

```bash
# sửa 1 dòng comment nhỏ trong backend/ và frontend/
git add backend/ frontend/
git commit -m "chore: test CI/CD update tag to electronics-shop-monitoring chart"
git push origin main
```

Theo dõi tab **Actions**, xác nhận `backendTag`/`frontendTag` được ghi vào
đúng `helm/electronics-shop-monitoring/values.yaml`.

### 4.4. Đổi path Argo CD Application

Sửa `argo/argocd-application.yaml`:

```yaml
# argo/argocd-application.yaml
source:
  path: helm/electronics-shop-monitoring   # đổi từ helm/electronics-shop-rollout
```

Áp dụng bằng 1 trong 2 cách:
- `kubectl apply -f argo/argocd-application.yaml`, hoặc
- Argo CD UI → Application → **App Details** → phần **Source** → **EDIT**
  → sửa **Path** thành `helm/electronics-shop-monitoring` → **Save**.

Vì tên Rollout/Service (`backend`, `frontend`...) giữ nguyên giữa 2 chart,
Argo CD chỉ **update tại chỗ**, không gián đoạn traffic.

### 4.5. Kiểm tra

```bash
kubectl get rollout -n electronics-shop
kubectl get podmonitor -n electronics-shop
kubectl get configmap -n electronics-shop -l grafana_dashboard=1
```

---

## 5. Cấu hình Alertmanager gửi email qua Gmail

### 5.1. Cập nhật cấu hình

Thay thế cấu hình alertmanager trong `monitoring/kube-prometheus-stack-values.yaml`
thành đoạn sau:

```yaml
alertmanager:
  alertmanagerSpec:
    storage:
      volumeClaimTemplate:
        spec:
          storageClassName: local-path
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 2Gi
    # Gắn Secret chứa Gmail App Password (tạo ở bên dưới) — chart tự mount
    # vào /etc/alertmanager/secrets/alertmanager-gmail-credentials/password
    secrets:
      - alertmanager-gmail-credentials
  ingress:
    enabled: true
    ingressClassName: traefik
    hosts:
      - alertmanager.techshop.local
    paths: ["/"]
  config:
    global:
      smtp_smarthost: "smtp.gmail.com:587"
      smtp_from: "<gmail-dùng-để-gửi>@gmail.com"
      smtp_auth_username: "<gmail-dùng-để-gửi>@gmail.com"
      smtp_auth_password_file: /etc/alertmanager/secrets/alertmanager-gmail-credentials/password
      smtp_require_tls: true
    route:
      receiver: "email-notifications"
      group_by: ["alertname", "namespace"]
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 4h
      # BẮT BUỘC — chart mặc định có sẵn 1 sub-route trỏ receiver "null"
      # (route.routes). Helm merge "route" theo map (đệ quy, giữ lại field
      # cũ) nhưng merge "receivers" theo list (THAY THẾ hoàn toàn) — nếu
      # không khai "routes: []" để ghi đè, sub-route mặc định vẫn trỏ tới
      # receiver "null" đã bị ta xoá mất trong "receivers", gây lỗi
      # Operator "undefined receiver \"null\" used in route" (xem
      # kubectl logs deploy/kube-prometheus-stack-operator).
      routes: []
    receivers:
      - name: "email-notifications"
        email_configs:
          - to: "<email-nhận-cảnh-báo>@gmail.com"
            send_resolved: true
```

Điền giá trị thật của email, gmail gửi và nhận.

### 5.2. Lấy Gmail App Password

Gmail chặn đăng nhập SMTP trực tiếp bằng mật khẩu thường — bắt buộc dùng
App Password (cần 2-Step Verification đã bật):

1. Bật 2-Step Verification: `https://myaccount.google.com/security`
2. Tạo App Password: `https://myaccount.google.com/apppasswords` → đặt tên
   (vd `k3s-alertmanager`) → **Create** → copy chuỗi 16 ký tự ngay lúc đó
   (không xem lại được sau khi đóng popup). Nếu không thấy trang này / bị
   redirect về Security, nghĩa là bước 1 chưa hoàn tất — Google chỉ hiện App
   Passwords khi 2-Step Verification đã bật

### 5.3. Tạo Secret chứa App Password

Không đưa vào `values.yaml` hay `values-dev.yaml` dù có gitignore (App Password
nhạy cảm hơn cả harborAuth.password, vì nó gắn với tài khoản Gmail cá nhân)
— tạo thẳng bằng `kubectl`:

```bash
kubectl create secret generic alertmanager-gmail-credentials \
  -n monitoring \
  --from-literal=password='<dán-app-password-16-ký-tự>'
```

### 5.4. Áp dụng cấu hình SMTP

```bash
helm upgrade kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  -f monitoring/kube-prometheus-stack-values.yaml
```

Kiểm tra Alertmanager đã nạp đúng config (không còn `receivers: - name: "null"` mặc định):
```bash
kubectl exec -n monitoring alertmanager-kube-prometheus-stack-alertmanager-0 -c alertmanager -- \
  cat /etc/alertmanager/config_out/alertmanager.env.yaml | grep -A5 receivers
```

```bash
kubectl get alertmanager -n monitoring -o yaml | grep -A 8 "type: Reconciled"
# status: "True" — nếu "False" kèm message lỗi, xem log Operator:
kubectl logs -n monitoring deploy/kube-prometheus-stack-operator --tail=100 | grep -i alertmanager
```

### 5.5. Test gửi alert giả

```bash
curl -H "Content-Type: application/json" -d '[
  {
    "labels": {
      "alertname": "TestAlertFromCurl",
      "severity": "warning",
      "namespace": "monitoring"
    },
    "annotations": {
      "summary": "Alert test gửi tay để kiểm tra email Gmail"
    },
    "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"
  }
]' http://alertmanager.techshop.local/api/v2/alerts
```

Kiểm tra alert xuất hiện ở `http://alertmanager.techshop.local`. Đợi
~30-60s (`group_wait: 30s`) rồi kiểm tra hộp thư Gmail (kể cả mục Spam —
lần đầu SMTP gửi dễ bị đánh dấu spam). Nếu không thấy email, mở log để xem lỗi:
```bash
kubectl logs -n monitoring alertmanager-kube-prometheus-stack-alertmanager-0 -c alertmanager --tail=50
```

---

## 6. Tạo PodMonitor cho backend & frontend (Bỏ qua bước này vì project đã thực hiện và thêm vào sẵn rồi, chỉ cần vào Grafana chọn dashboard Backend - Electronics Sell App hoặc Frontend - Electronics Sell App và theo dõi biểu đồ thay đổi)

**Dùng `PodMonitor`, không dùng `ServiceMonitor`** — Argo Rollouts patch
thêm label `rollouts-pod-template-hash` vào `selector` của Service
`backend-stable`/`backend-canary` lúc runtime (đổi qua từng giai đoạn
canary), nên `ServiceMonitor` trỏ vào Service dễ chỉ scrape được 1 nửa số
Pod tại 1 thời điểm. `PodMonitor` chọn thẳng theo label Pod `app: backend`
— label này không đổi qua canary, luôn scrape đủ toàn bộ Pod hiện có.

### 6.1. Đặt tên container port

`templates/backend.yaml` và `templates/frontend.yaml`:
```yaml
ports: [{ name: http, containerPort: {{ .Values.backend.port }} }]
```

### 6.2. `values.yaml` — bật/tắt + path metrics

```yaml
monitoring:
  backend:
    enabled: true
    # Phải khớp label "release" mà kube-prometheus-stack đang dùng để lọc
    # PodMonitor (mặc định Operator chỉ đọc PodMonitor có
    # "release: <tên-Helm-release-lúc-cài>"). Kiểm tra: helm list -n monitoring
    prometheusReleaseLabel: kube-prometheus-stack
  frontend:
    enabled: true
    prometheusReleaseLabel: kube-prometheus-stack
    # Frontend expose ở "/api/metrics" (quy ước file-based routing của
    # Next.js App Router), khác "/metrics" bên backend (NestJS loại riêng
    # "/metrics" khỏi global prefix "api/v1" trong main.ts).
    metricsPath: /api/metrics
```

### 6.3. `templates/backend-podmonitor.yaml`

```yaml
{{- if .Values.monitoring.backend.enabled }}
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: backend
  namespace: {{ .Values.global.namespace }}
  labels:
    release: {{ .Values.monitoring.backend.prometheusReleaseLabel }}
spec:
  selector:
    matchLabels:
      app: backend
  namespaceSelector:
    matchNames:
      - {{ .Values.global.namespace }}
  podMetricsEndpoints:
    - port: http
      path: /metrics
      interval: 15s
{{- end }}
```

### 6.4. `templates/frontend-podmonitor.yaml`

```yaml
{{- if .Values.monitoring.frontend.enabled }}
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: frontend
  namespace: {{ .Values.global.namespace }}
  labels:
    release: {{ .Values.monitoring.frontend.prometheusReleaseLabel }}
spec:
  selector:
    matchLabels:
      app: frontend
  namespaceSelector:
    matchNames:
      - {{ .Values.global.namespace }}
  podMetricsEndpoints:
    - port: http
      path: {{ .Values.monitoring.frontend.metricsPath }}
      interval: 15s
{{- end }}
```

### 6.5. Áp dụng + kiểm tra

```bash
helm template . -f values.yaml --show-only templates/backend-podmonitor.yaml
helm template . -f values.yaml --show-only templates/frontend-podmonitor.yaml

git add helm/electronics-shop-monitoring/ backend/ frontend/
git commit -m "feat: expose Prometheus metrics + PodMonitor cho backend/frontend"
git push
```

Mở `http://prometheus.techshop.local` → **Status → Targets** → xác nhận
`electronics-shop/backend` và `electronics-shop/frontend` đều `UP`.

---

## 7. Vẽ Dashboard trong Grafana (Không cần thực hiện bước này vì project đã tạo ra xuất ra file Json cho cả dashboard backend và frontend rồi, chỉ thực hiện nếu có ý tưởng về 1 panel mới khác với các panel bên dưới, panel mới cũng tạo bằng cách nhập PromQL tương tự như bên dưới)

> **Lưu ý bắt buộc:** `http_requests_total`, `http_request_duration_seconds`
> và mọi metric mặc định của Node.js (`nodejs_*`) **trùng tên** giữa
> backend và frontend. Luôn lọc theo `app="backend"` hoặc `app="frontend"`
> trong mọi query (label này do `registry.setDefaultLabels({ app: '...' })`
> gắn sẵn ở tầng code), nếu không dashboard sẽ lẫn số liệu 2 nguồn.

Tạo dashboard mới: Trong Grafana → Dashboards → New → New Dashboard → Add new panel (cho mỗi panel bên dưới) → Đặt tên (Title) -> Edit/Configure Visualization -> chọn datasource Prometheus (đã tự cấu hình sẵn từ đầu) -> Sang tab Code -> Mỗi panel nhập PromQL bên dưới:

### 7.1. Request Rate (request/giây)

```promql
sum(rate(http_requests_total{namespace="electronics-shop", app="backend"}[5m])) by (route, method)
```

### 7.2. Error Rate % (tỷ lệ lỗi 5xx)

```promql
100 * (sum(rate(http_requests_total{namespace="electronics-shop", app="backend", status_code=~"5.."}[5m])) or vector(0))
    / sum(rate(http_requests_total{namespace="electronics-shop", app="backend"}[5m]))
```

`or vector(0)` — nếu chưa từng có request 5xx, time series đó **chưa tồn
tại** trong Prometheus (không phải "bằng 0"), khiến panel báo "No data"
thay vì hiện đúng `0%`.

### 7.3. Latency p95 / p50

```promql
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket{namespace="electronics-shop", app="backend"}[5m])) by (le, route)
)
```
*(đổi `0.95` → `0.5` cho panel p50 riêng — dùng để so sánh, p95 cao mà p50
vẫn thấp nghĩa là 1 nhóm nhỏ request bị chậm, không phải toàn hệ thống)*

`le` **bắt buộc giữ lại** trong `by (...)` — mất label này phá vỡ cấu trúc
bucket mà `histogram_quantile` cần để nội suy ra kết quả.

### 7.4. Node.js Runtime — Event Loop Lag

```promql
nodejs_eventloop_lag_seconds{namespace="electronics-shop", app="backend"}
```

Đo độ trễ event loop — tăng cao nghĩa là có code đồng bộ chặn event loop
quá lâu, không thấy được qua CPU/RAM container thông thường (cAdvisor).

### 7.5. Node.js Runtime — V8 Heap Usage %

```promql
100 * nodejs_heap_size_used_bytes{namespace="electronics-shop", app="backend"}
    / nodejs_heap_size_total_bytes{namespace="electronics-shop", app="backend"}
```

Tỷ lệ cao liên tục (>85-90%) nghĩa là GC đang phải chạy dồn dập để dọn chỗ
— dấu hiệu áp lực bộ nhớ ở tầng V8, khác hẳn RAM tổng của container
(cAdvisor không phân biệt được "dùng bình thường" hay "đang vật lộn").

Lặp lại đúng 6 panel trên cho **frontend**, chỉ đổi `app="backend"` thành
`app="frontend"`.

---

## 8. Xuất Dashboard ra JSON (dashboard-as-code) + ConfigMap (giống với phần 7 chỉ thực hiện phần này nếu có ý tưởng và muốn tạo ra 1 panel mới khác với 6 panel trên)

Container sidecar `grafana-sc-dashboards` (chạy cùng Pod Grafana) tự watch mọi
ConfigMap có label `grafana_dashboard: "1"` ở **mọi namespace**, tự nạp lại
— không cần import tay, và dashboard tự hồi sinh mỗi khi Pod Grafana bị
tạo lại (PVC hỏng, node restart...) vì nguồn thật nằm ở Git.

### 8.1. Xuất JSON đúng cách — Grafana 13 đổi schema mặc định

Từ Grafana 13, **Vào Dashboard → Edit → Edit as code** trả về schema mới ("V2 Resource",
`apiVersion: dashboard.grafana.app/v2`) — sidecar **không đọc được** schema
này, chỉ hiểu schema "Classic" cũ. Dùng API cũ (vẫn hoạt động đầy đủ cho
tương thích ngược) để lấy đúng format:

```bash
# UID lấy từ URL dashboard (/d/<uid>/...) hoặc từ metadata.name trong
# JSON Model V2 ở nút Edit as code
curl -s -u admin:<mật-khẩu-grafana> \
  http://grafana.techshop.local/api/dashboards/uid/<uid> \
  | jq '.dashboard' > helm/electronics-shop-monitoring/dashboards/backend-dashboard.json
```

Mở file, tìm dòng `"id"` **đầu tiên** (không nằm trong `panels`), sửa
thành `"id": null` nếu đang có số — để Grafana tạo dashboard mới thay vì
tìm đúng ID cũ của instance khác.

Lặp lại cho frontend, lưu vào `dashboards/frontend-dashboard.json`.

### 8.2. `templates/backend-grafana-dashboard.yaml`

```yaml
{{- if .Values.monitoring.backend.enabled }}
apiVersion: v1
kind: ConfigMap
metadata:
  name: backend-grafana-dashboard
  namespace: {{ .Values.global.namespace }}
  labels:
    grafana_dashboard: "1"
data:
  backend-dashboard.json: |
{{ .Files.Get "dashboards/backend-dashboard.json" | indent 4 }}
{{- end }}
```

### 8.3. `templates/frontend-grafana-dashboard.yaml`

```yaml
{{- if .Values.monitoring.frontend.enabled }}
apiVersion: v1
kind: ConfigMap
metadata:
  name: frontend-grafana-dashboard
  namespace: {{ .Values.global.namespace }}
  labels:
    grafana_dashboard: "1"
data:
  frontend-dashboard.json: |
{{ .Files.Get "dashboards/frontend-dashboard.json" | indent 4 }}
{{- end }}
```

### 8.4. Áp dụng qua Git

```bash
helm template . -f values.yaml --show-only templates/backend-grafana-dashboard.yaml

git add helm/electronics-shop-monitoring/templates/*-grafana-dashboard.yaml \
        helm/electronics-shop-monitoring/dashboards/
git commit -m "feat: dashboard-as-code cho backend/frontend (Grafana ConfigMap)"
git push
```

### 8.5. Xác nhận sidecar nạp đúng

```bash
kubectl logs -n monitoring kube-prometheus-stack-grafana-<pod-suffix> -c grafana-sc-dashboards --tail=30
```

**Kiểm chứng đúng cách — dashboard không xóa được qua UI Grafana:** dashboard được
provisioning sẽ báo `provisioned dashboard cannot be deleted` nếu thử xoá
tay qua UI (đây là **bằng chứng ConfigMap đã nạp thành công**, không phải
lỗi). Muốn test "Git là nguồn thật", xoá đúng ConfigMap:
```bash
kubectl delete configmap backend-grafana-dashboard -n electronics-shop
# đợi Argo CD tự sync lại (hoặc "argocd app sync <tên-app>")
```
Dashboard sẽ tự biến mất rồi tự xuất hiện lại sau khi Argo CD vá lại state
— xác nhận đúng chu trình dashboard-as-code hoạt động.

---

## 9. Bảng tra cứu nhanh — các lỗi đã gặp

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| `node-exporter` `CreateContainerError`, log `not a shared or slave mount` | WSL2 mount `/` ở chế độ `private` | `sudo mount --make-rshared /` + thêm vào `/etc/wsl.conf` |
| Target `kube-proxy`/`scheduler`/`controller-manager`/`etcd` luôn `DOWN` | Các component này bind `127.0.0.1`, Prometheus (network namespace riêng) không với tới | Tắt hẳn ServiceMonitor tương ứng trong values (`enabled: false`) |
| Grafana `OOMKilled`, restart liên tục | `limits.memory: 256Mi` không đủ cho Grafana 13.x (tầng Bleve index tốn thêm RAM) | Tăng `limits.memory` lên `512Mi` |
| Alertmanager Operator log `undefined receiver "null" used in route` | Helm merge `receivers` (list) THAY THẾ hoàn toàn, nhưng `route.routes` (map, merge đệ quy) vẫn giữ sub-route mặc định trỏ receiver `"null"` đã bị xoá | Thêm `route.routes: []` để ghi đè hẳn |
| Grafana Settings → JSON Model không có field `id` cấp dashboard giống hướng dẫn | Grafana 13 đổi schema mặc định sang "V2 Resource", sidecar không đọc được | Lấy JSON qua API `/api/dashboards/uid/{uid}` (trả về schema Classic) |
| Xoá dashboard trên UI báo "provisioned dashboard cannot be deleted" | Dashboard đang được provisioning từ ConfigMap — đúng hành vi, không phải lỗi | Xoá đúng nguồn: `kubectl delete configmap ...` |
| Panel Error Rate báo "No data" dù chưa có lỗi | Time series `status_code=~"5.."` chưa tồn tại (không phải "bằng 0") khi chưa có request lỗi nào | Thêm `or vector(0)` vào query |
| Dashboard backend lẫn số liệu frontend (hoặc ngược lại) | `http_requests_total` và các metric Node.js trùng tên giữa 2 app | Luôn lọc thêm `app="backend"` / `app="frontend"` trong mọi query |