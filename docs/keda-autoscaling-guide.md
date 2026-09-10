# Hướng dẫn: Chuyển từ HPA sang KEDA event-driven autoscaling

File này ghi lại toàn bộ quá trình chuyển autoscaling của backend/frontend
từ HPA gốc (chỉ CPU/RAM) sang **KEDA**, mở rộng thêm khả năng scale theo
metric nghiệp vụ thật (request rate) lấy từ Prometheus, bên cạnh CPU/RAM
vẫn giữ lại như 1 trigger song song.

Yêu cầu trước khi làm theo file này: đã hoàn thành
`prometheus-grafana-alertmanager-monitoring-guide.md` (Prometheus + Grafana
+ Alertmanager chạy ổn định trên chart `helm/electronics-shop-monitoring`,
metric `http_requests_total` đã có sẵn qua PodMonitor).

## 0. Vị trí đặt file trong project

```
electronics-sell-app-thanhde/
├── keda/
│   └── keda-values.yaml                     
├── docs/
│   └── keda-autoscaling-guide.md            # file này
└── helm/
    ├── electronics-shop/                    # chart gốc — GIỮ NGUYÊN
    ├── electronics-shop-rollout/             # chart Rollout canary — GIỮ NGUYÊN
    ├── electronics-shop-monitoring/          # chart Rollout + monitoring — GIỮ NGUYÊN
    └── electronics-shop-keda/                # chart mới: thay hpa.yaml -> scaledobject.yaml
        └── templates/
            └── scaledobject.yaml
```

`keda/` đặt ngang hàng `monitoring/` (không lồng vào trong `monitoring/`)
vì phục vụ 2 mục đích khác nhau: `monitoring/` là observability
(Prometheus/Grafana/Alertmanager), `keda/` là autoscaling — tuy KEDA có
dùng dữ liệu từ Prometheus, bản thân KEDA vẫn là 1 hạ tầng độc lập, cài
đặt riêng, không phụ thuộc trực tiếp vào chart `kube-prometheus-stack`.

---

## 1. Tách ScaledObject (KEDA) sang chart riêng

Theo đúng mô hình "copy chart + đổi path Argo CD" đã dùng ở các lần chuyển
giai đoạn trước (`electronics-shop` → `electronics-shop-rollout` →
`electronics-shop-monitoring`) — mỗi chart là 1 snapshot chạy được độc
lập, không sửa ngược vào chart cũ để tài liệu cũ luôn khớp đúng trạng thái
nó mô tả.

### 1.1. Copy chart `electronics-shop-monitoring` sang `electronics-shop-keda` (bỏ qua bước này vì quá trình này đã được cập nhật vào project)

```bash
cp -r helm/electronics-shop-monitoring helm/electronics-shop-keda
```

Sửa `helm/electronics-shop-keda/Chart.yaml`:
```yaml
apiVersion: v2
name: electronics-shop-keda
description: TechShop (Rollout canary + Prometheus/Grafana monitoring) + KEDA event-driven autoscaling (thay thế HPA gốc)
type: application
version: 0.1.0
appVersion: "1.0.0"
```

*(An toàn — không có template nào dùng `.Chart.Name` để đặt tên resource,
đổi tên chỉ ảnh hưởng metadata, không đổi tên Service/Rollout thật.)*

Xoá file HPA cũ, sẽ thay bằng `ScaledObject` ở Mục 5:
```bash
rm helm/electronics-shop-keda/templates/hpa.yaml
```

### 1.2. Đổi biến CI/CD

GitHub repo → **Settings → Secrets and variables → Actions → Variables**,
sửa `HELM_VALUES_FILE`:
```
helm/electronics-shop-keda/values.yaml
```

### 1.3. Test CI/CD ghi đúng tag vào chart mới

```bash
# sửa 1 dòng comment nhỏ trong backend/ và frontend/
git add backend/ frontend/
git commit -m "chore: test CI/CD update tag to electronics-shop-keda chart"
git push origin main
```

Theo dõi tab **Actions**, xác nhận `backendTag`/`frontendTag` được ghi vào
đúng `helm/electronics-shop-keda/values.yaml`.

### 1.4. Đổi path Argo CD Application

Sửa `argo/argocd-application.yaml`:
```yaml
source:
  path: helm/electronics-shop-keda   # đổi từ helm/electronics-shop-monitoring
```

Áp dụng bằng 1 trong 2 cách:
- `kubectl apply -f argo/argocd-application.yaml`, hoặc
- Argo CD UI → Application → **App Details** → phần **Source** → **EDIT**
  → sửa **Path** thành `helm/electronics-shop-keda` → **Save**.

Vì tên Rollout/Service (`backend`, `frontend`...) giữ nguyên giữa 2 chart,
Argo CD chỉ **update tại chỗ**, không gián đoạn traffic. Vì `hpa.yaml` đã
bị xoá khỏi chart mới, Argo CD tự động **prune** (xoá) HPA cũ trên cluster
khi sync sang chart này — không cần `kubectl delete hpa` tay, miễn Application
có bật `prune: true` trong `syncPolicy` (kiểm tra lại trong
`argo/argocd-application.yaml` nếu chưa chắc).

### 1.5. Kiểm tra

```bash
kubectl get rollout -n electronics-shop
kubectl get hpa -n electronics-shop        # phải KHÔNG còn thấy HPA cũ (backend/frontend)
kubectl get podmonitor -n electronics-shop
```

---

## 2. Cài đặt KEDA

### 2.1. Thêm Helm repo + namespace riêng

```bash
helm repo add kedacore https://kedacore.github.io/charts
helm repo update

kubectl create namespace keda
```

Namespace riêng `keda` (không chung `electronics-shop`) — đây là hạ tầng
autoscaling toàn cluster, không phải app.

### 2.2. Tạo file values (bỏ qua)

`keda/keda-values.yaml`:

```yaml
# Resource cho 2 component chính: Operator (quản lý ScaledObject, activate
# 0<->1) và Metrics Server/Adapter (expose external.metrics.k8s.io cho HPA
# đọc). Cụm k3s local tài nguyên hạn chế nên set request/limit nhỏ, tương
# tự cách đã làm với kube-prometheus-stack.
operator:
  resources:
    requests: { cpu: 100m, memory: 128Mi }
    limits: { cpu: 500m, memory: 512Mi }

metricsServer:
  resources:
    requests: { cpu: 100m, memory: 128Mi }
    limits: { cpu: 500m, memory: 512Mi }

# Validate ScaledObject lúc apply (vd chặn 2 ScaledObject/HPA cùng trỏ 1
# scaleTargetRef, chặn minReplicaCount > maxReplicaCount...) — nên bật.
webhooks:
  enabled: true
```

### 2.3. Cài bằng Helm

```bash
helm install keda kedacore/keda \
  --namespace keda \
  -f keda/keda-values.yaml
```

### 2.4. Kiểm tra cài đặt thành công

```bash
kubectl get pods -n keda
```
Phải thấy 3 pod `Running`: `keda-operator-...`, `keda-operator-metrics-apiserver-...`,
`keda-admission-webhooks-...`. Pod `keda-operator` restart 1 lần lúc mới
cài là bình thường (đợi cert của webhook sẵn sàng), không phải lỗi.

```bash
kubectl get crd | grep keda
```
Phải thấy `scaledobjects.keda.sh`, `scaledjobs.keda.sh`,
`triggerauthentications.keda.sh`, `clustertriggerauthentications.keda.sh`.

```bash
kubectl get apiservices | grep external.metrics
```
Xác nhận Metrics Adapter đã đăng ký vào `external.metrics.k8s.io`.

---

## 3. Kiến trúc KEDA — tóm tắt để tra cứu nhanh

| Component | Vai trò | Khi nào hoạt động |
|---|---|---|
| **KEDA Operator** | Đọc `ScaledObject`, tự tạo HPA thật phía sau (`keda-hpa-<tên>`); tự tay scale 0<->1 (bỏ qua HPA vì HPA core không patch được 0) | Định kỳ theo `pollingInterval` (mặc định 30s) |
| **KEDA Metrics Adapter** | Expose giá trị metric qua `external.metrics.k8s.io` để HPA đọc; watch `ScaledObject` để biết cấu hình scaler nào ứng với metric nào | Bị động — chỉ gọi scaler khi HPA hỏi tới (nhịp sync HPA của k8s core, mặc định 15s) |
| **KEDA Admission Webhook** | `ValidatingAdmissionWebhook` — chặn tạo `ScaledObject` sai cấu hình (trùng `scaleTargetRef` với HPA/ScaledObject khác, thiếu `resources.requests` khi dùng trigger cpu/memory, `min > max`...) | Chỉ lúc `kubectl apply`/Argo CD sync, không tham gia runtime scale |

**HPA do KEDA tạo vẫn dùng đúng công thức chuẩn Kubernetes**, chỉ khác
nguồn `currentMetricValue` đến từ Adapter thay vì `metrics-server`:
```
desiredReplicas = ceil[ currentReplicas × (currentMetricValue / desiredMetricValue) ]
```
Nếu nhiều trigger cùng lúc (cpu + memory + prometheus), HPA tính
`desiredReplicas` riêng cho từng trigger rồi **lấy giá trị lớn nhất**.

`activationThreshold` (quyết định 0↔1, do Operator xử lý) khác với
`threshold` (dùng trong công thức scale 1→N, do HPA xử lý) — 2 khái niệm
tách biệt. Vì backend/frontend luôn có `minReplicaCount >= 1`, phần
activate 0→1 gần như không có tác dụng thực tế trong setup này.

---

## 4. Viết `ScaledObject`

### 4.1. Thêm values vào `helm/electronics-shop-keda/values.yaml` (bỏ qua)

Thay hẳn khối `autoscaling:` cũ (dùng cho HPA) bằng bản này:

```yaml
keda:
  # Địa chỉ Prometheus nội bộ cluster để KEDA query — verify đúng tên
  # Service bằng: kubectl get svc -n monitoring | grep prometheus
  prometheusServerAddress: http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090
  # Route hạ tầng (health check, self-scrape metrics...) cần loại khỏi
  # query trigger prometheus — field RIÊNG của KEDA, KHÔNG dùng chung
  # monitoring.alerts.nonBusinessRoutesRegex dù giá trị hiện đang giống
  # nhau: 1 cái quyết định ngưỡng cảnh báo lỗi/latency, 1 cái quyết định
  # số pod thật sự chạy — 2 mục đích khác nhau, nên tách field.
  nonBusinessRoutesRegex: "/metrics|/api/metrics|/api/ping|/api/v1/health"

autoscaling:
  backend:
    enabled: true
    minReplicas: 1
    maxReplicas: 8
    pollingInterval: 30
    cooldownPeriod: 300
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
    prometheus:
      enabled: true
      # Ngưỡng request/s TRUNG BÌNH MỖI POD — không phải tổng traffic.
      # Ví dụ: 4 pod, tổng 60 req/s -> avg mỗi pod = 15 -> vượt 10 -> scale up.
      threshold: "10"
  frontend:
    enabled: true
    minReplicas: 1
    maxReplicas: 8
    pollingInterval: 30
    cooldownPeriod: 300
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
    prometheus:
      enabled: true
      threshold: "10"
```

### 4.2. `helm/electronics-shop-keda/templates/scaledobject.yaml` (bỏ qua)

```yaml
{{/*
  Thay thế hoàn toàn templates/hpa.yaml của chart electronics-shop-monitoring.

  Mỗi ScaledObject khai 3 trigger cùng lúc: cpu, memory, prometheus. Giống
  hệt cách HPA multi-metric hoạt động: KEDA tính desiredReplicas RIÊNG cho
  từng trigger theo đúng công thức chuẩn, rồi HPA (do KEDA operator tạo)
  LẤY GIÁ TRỊ LỚN NHẤT trong tất cả — chỉ cần 1 trigger vượt ngưỡng là đã
  scale up.
*/}}
{{- if .Values.autoscaling.backend.enabled }}
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: backend
  namespace: {{ .Values.global.namespace }}
spec:
  scaleTargetRef:
    # Giữ nguyên như hpa.yaml cũ — backend là Rollout (Argo Rollouts CRD),
    # có sẵn "/scale" subresource nên KEDA điều khiển được y hệt Deployment.
    apiVersion: argoproj.io/v1alpha1
    kind: Rollout
    name: backend
  minReplicaCount: {{ .Values.autoscaling.backend.minReplicas }}
  maxReplicaCount: {{ .Values.autoscaling.backend.maxReplicas }}
  # Nhịp Operator tự hỏi scaler để quyết định activate/deactivate (0<->1) —
  # KHÔNG liên quan tới nhịp HPA đọc external.metrics.k8s.io (nhịp đó do
  # k8s core quyết định, mặc định 15s, không cấu hình ở đây).
  pollingInterval: {{ .Values.autoscaling.backend.pollingInterval }}
  # Vì minReplicaCount >= 1 (không scale về 0), cooldownPeriod thực chất
  # không có tác dụng cho case này — giữ lại để values.yaml nhất quán,
  # phòng khi sau này có service khác trong chart cần scale về 0.
  cooldownPeriod: {{ .Values.autoscaling.backend.cooldownPeriod }}
  # Giữ nguyên hành vi chống flapping y hệt hpa.yaml cũ.
  advanced:
    horizontalPodAutoscalerConfig:
      behavior:
        scaleDown:
          stabilizationWindowSeconds: 60
        scaleUp:
          stabilizationWindowSeconds: 0
  triggers:
    # --- Trigger 1: CPU (tương đương metrics.type=Resource/cpu của HPA cũ) ---
    - type: cpu
      metricType: Utilization
      metadata:
        value: "{{ .Values.autoscaling.backend.targetCPUUtilizationPercentage }}"

    {{- if .Values.autoscaling.backend.targetMemoryUtilizationPercentage }}
    # --- Trigger 2: Memory (tương đương metrics.type=Resource/memory) ---
    - type: memory
      metricType: Utilization
      metadata:
        value: "{{ .Values.autoscaling.backend.targetMemoryUtilizationPercentage }}"
    {{- end }}

    {{- if .Values.autoscaling.backend.prometheus.enabled }}
    # --- Trigger 3: Prometheus — request rate trung bình MỖI POD ---
    # sum by (pod): gom request rate mọi route/method/status_code về còn 1
    # số/pod. avg(...): lấy trung bình giữa các pod hiện có -> ĐÚNG ý nghĩa
    # "target trung bình mỗi pod" mà công thức HPA cần (không dùng sum()
    # thô vì tổng luôn tăng theo số pod, khiến scale không hội tụ).
    # route!~ loại các route hạ tầng (health check, self-scrape metrics...)
    # do kubelet/Prometheus tự gọi định kỳ, không phải traffic người dùng
    # thật — nếu không loại, "baseline nhiễu nền" sẽ làm threshold sai lệch.
    - type: prometheus
      metadata:
        serverAddress: {{ .Values.keda.prometheusServerAddress }}
        query: >-
          avg(sum by (pod) (rate(http_requests_total{namespace="{{ .Values.global.namespace }}", app="backend", route!~"{{ .Values.keda.nonBusinessRoutesRegex }}"}[1m])))
        threshold: "{{ .Values.autoscaling.backend.prometheus.threshold }}"
        # Chỉ activate 0->1 khi có ít nhất traffic nhỏ giọt — không có tác
        # dụng thực tế ở case này vì minReplicaCount>=1, giữ mặc định 0.
        activationThreshold: "0"
    {{- end }}
{{- end }}
---
{{- if .Values.autoscaling.frontend.enabled }}
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: frontend
  namespace: {{ .Values.global.namespace }}
spec:
  scaleTargetRef:
    # Tương tự backend — xem comment chi tiết ở khối backend phía trên.
    apiVersion: argoproj.io/v1alpha1
    kind: Rollout
    name: frontend
  minReplicaCount: {{ .Values.autoscaling.frontend.minReplicas }}
  maxReplicaCount: {{ .Values.autoscaling.frontend.maxReplicas }}
  pollingInterval: {{ .Values.autoscaling.frontend.pollingInterval }}
  cooldownPeriod: {{ .Values.autoscaling.frontend.cooldownPeriod }}
  advanced:
    horizontalPodAutoscalerConfig:
      behavior:
        scaleDown:
          stabilizationWindowSeconds: 60
        scaleUp:
          stabilizationWindowSeconds: 0
  triggers:
    - type: cpu
      metricType: Utilization
      metadata:
        value: "{{ .Values.autoscaling.frontend.targetCPUUtilizationPercentage }}"

    {{- if .Values.autoscaling.frontend.targetMemoryUtilizationPercentage }}
    - type: memory
      metricType: Utilization
      metadata:
        value: "{{ .Values.autoscaling.frontend.targetMemoryUtilizationPercentage }}"
    {{- end }}

    {{- if .Values.autoscaling.frontend.prometheus.enabled }}
    - type: prometheus
      metadata:
        serverAddress: {{ .Values.keda.prometheusServerAddress }}
        query: >-
          avg(sum by (pod) (rate(http_requests_total{namespace="{{ .Values.global.namespace }}", app="frontend", route!~"{{ .Values.keda.nonBusinessRoutesRegex }}"}[1m])))
        threshold: "{{ .Values.autoscaling.frontend.prometheus.threshold }}"
        activationThreshold: "0"
    {{- end }}
{{- end }}
```

Commit + push để Argo CD tự sync (đúng luồng GitOps của project, không
`helm upgrade` tay):
```bash
git add helm/electronics-shop-keda/
git commit -m "feat: thêm ScaledObject (KEDA) thay thế HPA gốc cho backend/frontend"
git push origin main
```

### 4.3. Kiểm tra tĩnh sau khi sync

```bash
kubectl get scaledobject -n electronics-shop
```
Cột `READY` phải `True`. Cột `ACTIVE` phụ thuộc hoàn toàn vào trigger
`prometheus` (trigger `cpu`/`memory` không có khái niệm activation) — nếu
chưa có traffic thật, `ACTIVE=False` là **bình thường, không phải lỗi**,
pod vẫn chạy đủ nhờ `minReplicaCount`, 2 cơ chế này độc lập nhau.

```bash
kubectl get hpa -n electronics-shop
```
Phải thấy `keda-hpa-backend`, `keda-hpa-frontend` (tiền tố `keda-hpa-` do
KEDA tự đặt).

```bash
kubectl describe scaledobject backend -n electronics-shop
```
Xem `Events` ở cuối nếu nghi ngờ cấu hình trigger sai (sai
`serverAddress`, sai tên metric...).

---

## 5. Test kiểm chứng KEDA scale

### 5.1. Xác nhận Adapter query được Prometheus

```bash
kubectl get hpa keda-hpa-backend -n electronics-shop -o yaml
```
Lấy chính xác tên metric (`s2-prometheus` — số thứ tự theo vị trí trigger
`prometheus` trong mảng `triggers`, ở đây là index 2 vì đứng sau `cpu`,
`memory`) và `selector.matchLabels` trong phần `spec.metrics[].external`,
rồi dùng lại y nguyên (không tự đoán/gõ tay) để gọi trực tiếp Adapter:

```bash
kubectl get --raw "/apis/external.metrics.k8s.io/v1beta1/namespaces/electronics-shop/s2-prometheus?labelSelector=scaledobject.keda.sh%2Fname%3Dbackend" | jq
```
(`%2F` = `/`, `%3D` = `=`, bắt buộc encode vì `labelSelector` cần đúng
định dạng `key=value` và key ở đây có dấu `/`.) Trả về JSON có `value` hợp
lệ nghĩa là toàn bộ pipeline Adapter → Prometheus scaler → Prometheus đã
thông, còn lại chỉ là chờ đủ tải.

### 5.2. Tạo tải để kích hoạt trigger `prometheus`

Vì threshold là `10` req/s **trung bình mỗi pod**, và metric dùng cửa sổ
`rate(...[1m])`, cần tải liên tục ít nhất 1-2 phút.

Cài Apache Bench (có sẵn trong apt, không cần Go):
```bash
sudo apt update && sudo apt install -y apache2-utils
```

Bắn tải vào 1 route nghiệp vụ thật (không dùng route đã bị loại bởi
`nonBusinessRoutesRegex`):
```bash
ab -t 180 -c 20 -n 1000000 http://techshop.local/api/v1/catalog/products
```
(`-n` phải đặt số rất lớn để `-t 180` giây thật sự là điều kiện dừng, chứ
không phải `-n`.)

### 5.3. Quan sát scale-up theo thời gian thực

Mở song song nhiều terminal:
```bash
# Terminal 1: theo dõi HPA đổi giá trị/replicas real-time
kubectl get hpa -n electronics-shop -w

# Terminal 2: theo dõi pod mới được tạo
kubectl get pods -n electronics-shop -l app=backend -w
```

Timeline kỳ vọng: `rate(...[1m])` cần ~1 phút tải mới phản ánh đúng trong
Prometheus → Adapter trả giá trị mới ngay khi HPA hỏi (nhịp 15s) →
`stabilizationWindowSeconds: 0` cho scaleUp nên HPA scale gần như ngay khi
thấy vượt ngưỡng.

**Lưu ý quan trọng khi đọc kết quả:** trong quá trình bắn tải để kích
hoạt trigger `prometheus`, CPU của pod cũng tăng theo (xử lý nhiều request
hơn tốn CPU hơn) — nên `kubectl get hpa keda-hpa-backend -n electronics-shop -o yaml`
phần `status.currentMetrics` có thể cho thấy **cả 2 trigger `cpu` và
`prometheus` cùng vượt ngưỡng**, thậm chí tỷ lệ vượt ngưỡng của `cpu` có
lúc còn cao hơn `prometheus`. Đây là hành vi đúng của multi-trigger (lấy
giá trị lớn nhất trong tất cả), **không có nghĩa là trigger `prometheus`
không hoạt động** — chỉ là cả 2 cùng phản ứng với cùng 1 tải thật, không
tách bạch tuyệt đối được "trigger nào gây ra scale" khi test bằng traffic
HTTP thật (vì traffic tăng luôn kéo theo cả request rate lẫn CPU tăng
cùng lúc). Muốn tách hẳn 2 trigger để so sánh độc lập, cần fake tải kiểu
khác nhau riêng biệt (vd script CPU-bound thuần không qua HTTP) — không
cần thiết cho mục đích xác nhận KEDA hoạt động đúng.

### 5.4. Kiểm tra scale-down

Dừng tải (`Ctrl+C`), tiếp tục `kubectl get hpa -w` — vì
`scaleDown.stabilizationWindowSeconds: 60`, phải chờ đủ 60 giây traffic
thấp liên tục mới thấy replicas giảm, không giảm ngay lập tức.

### 5.5. Kiểm chứng bằng Grafana (không bắt buộc)

Mở `http://grafana.techshop.local`, panel request rate + thêm 1 panel
đếm số pod nếu dashboard hiện tại chưa có:
```promql
count(kube_pod_status_phase{namespace="electronics-shop", pod=~"backend.*", phase="Running"})
```
Nhìn 2 đường cùng lúc để xác nhận số pod tăng đúng theo request rate tăng.

---

## 6. Bảng tra cứu nhanh — các lỗi đã gặp

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| Apply `ScaledObject` bị `Forbidden: admission webhook "vscaledobject.kb.io" denied the request` | HPA cũ (hoặc `ScaledObject` khác) vẫn còn trỏ cùng `scaleTargetRef` — webhook chặn 2 nguồn cùng điều khiển 1 object | Xoá HPA cũ trước khi apply (`kubectl delete hpa ...`), hoặc để Argo CD tự prune nếu `hpa.yaml` đã bị xoá khỏi chart |
| `kubectl get --raw ".../s0-prometheus"` báo `scaledObject name is not specified` | Thiếu query param `labelSelector`; KEDA cũng không nhất thiết đặt tên metric là `s0-...` — số thứ tự theo VỊ TRÍ trigger trong mảng `triggers`, không phải luôn bắt đầu từ 0 nếu trigger `prometheus` không phải trigger đầu tiên | Lấy đúng tên metric + `selector.matchLabels` từ `kubectl get hpa ... -o yaml`, không đoán tay; thêm `?labelSelector=scaledobject.keda.sh%2Fname%3D<tên>` |
| Cột `ACTIVE` của `ScaledObject` là `False` dù pod vẫn chạy đủ | `minReplicaCount` và `ACTIVE` là 2 cơ chế độc lập — `ACTIVE` chỉ phản ánh trigger có activation (như `prometheus`) đã vượt `activationThreshold` chưa, không liên quan gì tới việc pod có đang chạy hay không | Bình thường khi chưa có traffic, không phải lỗi |
| Muốn cài `hey` để tạo tải nhưng WSL2 không có sẵn Go | `hey` cần Go để `go install`, không có trong apt mặc định | Dùng `apache2-utils` (`ab`) có sẵn trong apt, hoặc cài `k6` qua repo apt riêng (`dl.k6.io`) |
| Test trigger `prometheus` bằng traffic HTTP thật nhưng thấy cả CPU cũng tăng, không tách bạch được trigger nào gây scale | Traffic HTTP tăng luôn kéo theo cả request rate lẫn CPU tăng cùng lúc — HPA multi-trigger lấy giá trị lớn nhất trong tất cả nên cả 2 cùng phản ứng | Chấp nhận như hành vi đúng của multi-trigger; nếu cần tách riêng, phải tạo tải CPU-bound thuần (không qua HTTP) thay vì traffic thật |