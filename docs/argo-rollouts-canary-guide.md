# Hướng dẫn: Cài Argo Rollouts & demo Canary Deployment (Traffic Routing qua Traefik)

File này ghi lại toàn bộ quá trình chuyển `backend`/`frontend` từ `Deployment`
rolling-update thường (xem `argocd-rolling-update-guide.md`) sang **canary
deployment** bằng Argo Rollouts, dùng Traefik có sẵn trong K3s làm traffic
router — không cần cài thêm plugin ngoài.

Yêu cầu trước khi làm theo file này: đã hoàn thành
`argocd-rolling-update-guide.md` (Argo CD chạy tốt, rolling update chart
`helm/electronics-shop` hoạt động ổn định).

## 0. Vị trí đặt file trong project

```
electronics-sell-app-thanhde/
├── argo/
│   ├── argocd-application.example.yaml    # mẫu, có sẵn ignoreDifferences cho Rollout
│   ├── argocd-application.yaml            # bản copy điền giá trị thật, GITIGNORE
│   ├── argo-rollouts-values.yaml          # values cho chart argo-rollouts (dashboard, ingress, traefik api group)
├── docs/
│   ├── argocd-rolling-update-guide.md
│   └── argo-rollouts-canary-guide.md      # file này
├── helm/
│   ├── electronics-shop/                  # chart gốc (Deployment thường) — GIỮ NGUYÊN
│   └── electronics-shop-rollout/          # chart mới (Rollout canary)
│       └── templates/
│           ├── backend.yaml               # Rollout + Service stable/canary
│           ├── backend-traffic.yaml       # TraefikService + IngressRoute
│           ├── frontend.yaml              # Rollout + Service stable/canary + hairpin qua Traefik
│           └── frontend-traffic.yaml      # TraefikService + IngressRoute
```

Chart `electronics-shop-rollout` là **bản copy** của `electronics-shop` —
giữ nguyên chart gốc để dễ quay lại (chỉ cần đổi `path` trong
`argocd-application.yaml`), không sửa trực tiếp lên chart đang chạy thật.

---

## 1. Cài Argo Rollouts

```bash
helm repo add argo https://argoproj.github.io/argo-helm   # bỏ qua nếu đã add lúc cài Argo CD
helm repo update

helm install argo-rollouts argo/argo-rollouts \
  --namespace argo-rollouts \
  --create-namespace
```

Kiểm tra:
```bash
kubectl get pods -n argo-rollouts
```

### 1.1. Cài CLI `kubectl argo rollouts`

CLI là **binary client-side**, không phải resource chạy trong cluster, nên
Helm không quản lý được — phải cài thủ công:

```bash
curl -LO https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-linux-amd64
chmod +x kubectl-argo-rollouts-linux-amd64
sudo mv kubectl-argo-rollouts-linux-amd64 /usr/local/bin/kubectl-argo-rollouts
```

*(macOS: đổi `linux-amd64` thành `darwin-amd64`/`darwin-arm64` tuỳ chip.)*

Kiểm tra:
```bash
kubectl argo rollouts version
```

---

## 2. Vì sao dùng Traefik có sẵn (native) thay vì Gateway API Plugin

Argo Rollouts hỗ trợ chia traffic canary theo 2 hướng khác nhau:

| | Traefik native (dùng ở đây) | Gateway API Plugin |
|---|---|---|
| Cần cài thêm gì | Không — Traefik đã có sẵn trong K3s | Phải cài Gateway API CRDs, đổi Traefik sang chạy như Gateway provider |
| Đổi Ingress hiện tại | Không (path còn lại vẫn dùng `Ingress` thường) | Có — phải viết lại `HTTPRoute` thay `Ingress` |
| Khi lên EKS (ALB) | Vẫn phải viết lại cho `trafficRouting.alb` (native, không cần plugin) | Có thể giữ lại `HTTPRoute`, chỉ đổi Gateway Controller |
| Độ chín | Ổn định, nhiều ví dụ | Còn mới, ít ví dụ hơn |

Vì K3s dùng Traefik làm Ingress Controller mặc định, dùng thẳng
`trafficRouting.traefik` (built-in trong Argo Rollouts controller, không
phải "plugin" đúng nghĩa) là lựa chọn đơn giản nhất — không cần học thêm
Gateway API, không cần đổi kiến trúc Ingress đang có. Dù lên EKS sau này
phải cấu hình lại `trafficRouting.alb` (cũng native), không có cách nào
"local xong chạy thẳng lên cloud không cần đổi gì" — traffic routing luôn
gắn với đúng ingress/mesh đang dùng.

### 2.1. Lưu ý quan trọng: Traefik v3 (K3s bản mới) đổi CRD group

Traefik v2.x dùng CRD group `traefik.containo.us`, Traefik v3.x (K3s bản mới
mặc định) đổi hẳn sang `traefik.io`. Kiểm tra bản đang chạy:

```bash
kubectl get crd | grep traefik
```

Nếu chỉ thấy `traefikservices.traefik.io` (không có `.containo.us`) —
**bắt buộc** phải cấu hình lại 2 flag của controller Argo Rollouts (xem mục
5.2), nếu không sẽ gặp lỗi `TrafficRoutingError: the server could not find
the requested resource` (do binary controller mặc định compile sẵn group
`traefik.containo.us`, không tồn tại trên Traefik v3).

---

## 3. Kiểm tra & đảm bảo RBAC cho `TraefikService`

Chart Helm `argo/argo-rollouts` mặc định đã bật `providerRBAC.providers.traefik`,
tự cấp quyền đọc/sửa `TraefikService` cho cả 2 group (`traefik.io` lẫn
`traefik.containo.us`). Kiểm tra lại cho chắc:

```bash
kubectl get clusterrole argo-rollouts -o yaml | grep -B2 -A6 traefik
```

Cần thấy `apiGroups: [traefik.io, traefik.containo.us]`, `resources:
[traefikservices]`.

Nếu không có, vá tay:

```bash
kubectl patch clusterrole argo-rollouts --type='json' -p='[{"op": "add", "path": "/rules/-", "value": {"apiGroups":["traefik.io"],"resources":["traefikservices"],"verbs":["get","list","watch","update","patch"]}}]'
```
Sau đó khởi động lại controller để chắc chắn nó nạp lại quyền mới (thường không bắt buộc với RBAC, nhưng làm cho chắc):

```bash
kubectl rollout restart deployment/argo-rollouts -n argo-rollouts
```

---

## 4. Cài Argo Rollouts Dashboard

### Cách 1 — Tạm thời qua CLI (nhanh, không cần đổi gì trong cluster)

```bash
kubectl argo rollouts dashboard -n electronics-shop
```

Mở `http://localhost:3100`. Có nút Promote/Abort/Restart ngay trên UI. Tắt
terminal là mất, phải chạy lại lệnh mỗi lần cần xem.

### Cách 2 — Cài thường trực + Ingress (giống Argo CD UI)

File `argo/argo-rollouts-values.yaml`:

```yaml
controller:
  # BẮT BUỘC nếu Traefik là v3 (chỉ có group "traefik.io") — xem mục 2.1.
  # Giá trị mặc định compile sẵn trong binary controller vẫn là group CŨ
  # "traefik.containo.us", không tồn tại trên Traefik v3 — nếu không set,
  # controller gọi API group không đăng ký, lỗi "TrafficRoutingError: the
  # server could not find the requested resource".
  extraArgs:
    - --traefik-api-group=traefik.io
    - --traefik-api-version=traefik.io/v1alpha1

dashboard:
  enabled: true

  # MẶC ĐỊNH Dashboard chỉ xem được Rollout trong đúng namespace nó được
  # deploy vào ("argo-rollouts") — không tự thấy Rollout ở namespace khác,
  # dù ClusterRole (mặc định createClusterRole: true) đã đủ quyền đọc toàn
  # cluster. Chốt cứng namespace cần xem:
  #   extraArgs:
  #     - --namespace=electronics-shop
  # Thay thế: dùng "--namespace=" (rỗng) để bật "full cluster mode", cho
  # chọn namespace trên UI — lưu ý ô chọn chỉ liệt kê namespace nào ĐANG
  # thực sự có object Rollout, không phải toàn bộ namespace của cluster.
  extraArgs:
    - --namespace=""

  ingress:
    enabled: true
    ingressClassName: traefik   # K3s cài sẵn Traefik. Trên EKS đổi thành "alb"
    hosts:
      - rollouts.techshop.local
    paths:
      - /
    pathType: Prefix
```

Áp dụng (đây là **upgrade**, không phải cài lại từ đầu):

```bash
helm upgrade argo-rollouts argo/argo-rollouts -n argo-rollouts -f argo/argo-rollouts-values.yaml
```

Thêm vào `/etc/hosts` (Windows: `C:\Windows\System32\drivers\etc\hosts`):
```
127.0.0.1   rollouts.techshop.local
```

Mở `http://rollouts.techshop.local`.

---

## 5. Chuẩn bị môi trường test — tắt HPA để quan sát rõ ràng

Vì HPA tự tăng/giảm số Pod liên tục, sẽ gây nhiễu khi quan sát canary lần
đầu (khó phân biệt "Pod đổi vì canary" hay "Pod đổi vì HPA"). Tắt tạm thời:

### 5.1. `helm/electronics-shop-rollout/values.yaml`

```yaml
autoscaling:
  backend:
    enabled: false
  frontend:
    enabled: false
```

### 5.2. `argo/argocd-application.yaml` — comment lại `ignoreDifferences` cho `replicas`

```yaml
  ignoreDifferences:
    # - group: argoproj.io
    #   kind: Rollout
    #   name: backend
    #   jsonPointers:
    #     - /spec/replicas
    # - group: argoproj.io
    #   kind: Rollout
    #   name: frontend
    #   jsonPointers:
    #     - /spec/replicas
```

*(Comment lại, không xoá — bật lại nguyên trạng sau khi test xong, nếu dự
định dùng lại HPA cho production.)*

Áp dụng bằng 1 trong 2 cách:
- `kubectl apply -f argo/argocd-application.yaml`, hoặc
- Argo CD UI → Application → **App Details** → tab **MANIFEST** → **EDIT** → xóa đoạn trên 
  (nếu có) → **Save**.

---

## 6. Cấu hình GitHub Variable cho CI/CD

Vào repo trên GitHub → **Settings** → **Secrets and variables** → **Actions**
→ tab **Variables** → **New repository variable**:

- Name: `HELM_VALUES_FILE`
- Value: `helm/electronics-shop-rollout/values.yaml`

Workflow `.github/workflows/deploy.yml` đọc biến này để biết ghi tag image
mới vào đúng file `values.yaml` của chart nào — không cần sửa/commit lại
file `.yml` mỗi lần đổi chart.

---

## 7. Thử nghiệm đầu tiên: xác nhận CI/CD ghi đúng tag vào chart mới

Sửa 1 dòng comment nhỏ bất kỳ trong code backend **và** frontend (không ảnh
hưởng logic), commit + push:

```bash
git add backend/ frontend/
git commit -m "chore: test CI/CD update tag to electronics-shop-rollout chart"
git push origin main
```

Theo dõi tab **Actions** trên GitHub: `CI` → `CD - Build, Scan & Push
Images` chạy xong, tự commit ngược lại cập nhật `backendTag`/`frontendTag`
trong `helm/electronics-shop-rollout/values.yaml` (không phải chart gốc).

---

## 8. Chuyển Argo CD Application sang chart Rollout

Sửa `argo/argocd-application.yaml`:

```yaml
  source:
    repoURL: https://github.com/<username>/<repo-name>.git
    targetRevision: main
    path: helm/electronics-shop-rollout   # đổi từ helm/electronics-shop
```

Áp dụng bằng 1 trong 2 cách:
- `kubectl apply -f argo/argocd-application.yaml`, hoặc
- Argo CD UI → Application → **App Details** → phần **Source** → **EDIT**
  → sửa **Path** thành `helm/electronics-shop-rollout` → **Save**.

Nếu đang bật `Prune`, Argo CD sẽ tự xoá resource của chart cũ
(`Deployment backend`/`frontend`) và tạo `Rollout` mới trong cùng
namespace — không cần thao tác tay.

Kiểm tra:
```bash
kubectl get rollout -n electronics-shop
kubectl get deployment -n electronics-shop   # kỳ vọng: không còn backend/frontend
```

---

## 9. Test canary thật — đổi version, quan sát rollout

### 9.1. Đổi code

- `backend/src/.../health.controller.ts`: đổi `version` (vd `'1.0.0'` →
  `'1.1.0'`).
- `backend/src/.../catalog.controller.ts`: đổi `_debugVersion` trong
  `findAll()`.

Commit + push:
```bash
git add backend/
git commit -m "feat: bump backend version, test canary rollout"
git push origin main
```

CI/CD build image mới → push Harbor → cập nhật `backendTag` trong
`helm/electronics-shop-rollout/values.yaml` → Argo CD sync (tự động nếu bật
Auto-Sync, hoặc bấm Sync thủ công).

### 9.2. Quan sát quá trình rollout — có 3 cách song song

- **CLI:**
  ```bash
  kubectl argo rollouts get rollout backend -n electronics-shop --watch
  ```
- **Argo CD UI:** thấy sync status (Synced/OutOfSync) + health tổng thể,
  không có thông tin chi tiết % weight/step.
- **Argo Rollouts Dashboard** (`rollouts.techshop.local`): trực quan nhất,
  thấy đúng step, % weight, số Pod mỗi bên, có nút Promote/Abort.

### 9.3. Quan sát % traffic chia thật — 2 cách, cùng mục đích: thấy tỉ lệ version thay đổi đúng theo weight đang cấu hình
 
**Cách 1 — Qua API, quan sát field `version` ở endpoint health:** gọi liên
tục vào `GET /api/v1/health` (route công khai, không qua SSR) — response
trả về field `version` lấy trực tiếp từ `health.controller.ts`, khác nhau
giữa bản stable và bản canary (đã đổi ở mục 9.1). Gọi dồn dập (tránh gọi
thưa, dễ lẫn với readiness/liveness probe của K8s cũng đang gọi cùng
endpoint này) để thấy đúng chu kỳ phân phối của Traefik:
 
```bash
for i in $(seq 1 20); do curl -s techshop.local/api/v1/health | grep -o '"version":"[^"]*"'; done
```
 
Đếm số lần xuất hiện mỗi `version` trong 20 lần gọi — tỉ lệ quan sát được
phải xấp xỉ đúng % weight hiện tại của bước canary (vd `setWeight: 20` →
khoảng 4/20 lần ra bản mới, `setWeight: 50` → khoảng 10/20 lần...).
 
**Cách 2 — Qua SSR của frontend, quan sát field `_debugVersion` trong log Pod (không phải Console trình duyệt):**
 
```bash
kubectl logs -f -l app=frontend -n electronics-shop --prefix
```
 
Mở trình duyệt vào `techshop.local`, F5 (reload) trang chủ **liên tục,
nhiều lần** — mỗi lần F5, Next.js server render lại `app/page.tsx`, gọi
`getProducts()` → gọi backend qua endpoint catalog (`GET /catalog/products`)
→ nhận về field `_debugVersion` (đã đổi trong `catalog.controller.ts` ở
mục 9.1) → CLI in ra dòng `[SSR] backend trả về từ bản: ...` trong log Pod
frontend. Vì `INTERNAL_API_URL` đã trỏ hairpin qua Traefik thay vì gọi
thẳng Service stable (xem `templates/frontend.yaml` + `frontend/lib/api.ts`),
request SSR này đi qua đúng `IngressRoute` → `TraefikService` như traffic
API thông thường — nên tỉ lệ `_debugVersion` cũ/mới xuất hiện trong log
cũng phải xấp xỉ đúng % weight hiện tại, y hệt logic ở Cách 1, chỉ khác
nguồn quan sát (log SSR thay vì response `curl` trực tiếp) và khác endpoint
bị gọi (`catalog/products` thay vì `health`).
 
Cả 2 cách đều dùng để kiểm chứng cùng 1 điều: **tỉ lệ phân phối traffic
thật giữa stable/canary có khớp đúng với `setWeight` đang cấu hình hay
không** — chạy song song cả 2 (1 terminal `curl` loop, 1 terminal
`kubectl logs -f`) giúp thấy rõ traffic cả API thuần lẫn SSR đều được
canary đúng như nhau, không riêng đường nào bị bỏ sót.

### 9.4. Promote qua bước `pause` vô thời hạn — 3 cách

```yaml
# Cách 1: Dùng lệnh kubectl argo rollouts promote backend -n electronics-shop
# Cách 2: Dùng Argo CD UI nhấn vào 3 chấm bên Rollout backend, rồi chọn
#   "Skip-current-step" (tương đương promote). Lúc đó Rollout sẽ bỏ qua step
#   pause này, tiếp tục chạy step setWeight: 50.
# Cách 3: Dùng Argo Rollouts UI (Dashboard) nhấn nút "Promote" trên Rollout backend.
```

Lặp lại việc quan sát % traffic (mục 9.3) sau mỗi lần promote, cho tới khi
Rollout đạt `Healthy` (100% traffic đã chuyển hẳn sang bản mới, `Stable RS`
đổi thành hash mới).

---

## 10. Sau khi test xong — bật lại HPA

Đảo ngược đúng 2 thay đổi ở mục 5:

1. `helm/electronics-shop-rollout/values.yaml`: đổi `autoscaling.backend.enabled`
   và `autoscaling.frontend.enabled` về lại `true`.
2. `argo/argocd-application.yaml`: bỏ comment lại khối `ignoreDifferences`
   cho `Rollout backend`/`frontend` (`/spec/replicas`).

Commit, push, apply/sync lại như bình thường.

---

## 11. Ghi chú kỹ thuật quan trọng (tra cứu nhanh)

- **Selector "ảo giác" giống nhau:** `backend-stable` và `backend-canary`
  đều khai `selector: { app: backend }` trong Git, nhưng Argo Rollouts tự
  PATCH thêm label `rollouts-pod-template-hash` khác nhau lúc runtime — chi
  tiết đầy đủ 3 giai đoạn (ổn định / đang canary / vừa promote) xem comment
  trong `templates/backend.yaml`.
- **`weight` trong `TraefikService` luôn bị ghi đè:** không cần khai trong
  Git, controller ghi đè vô điều kiện mỗi vòng reconcile — khai vào chỉ gây
  `OutOfSync` giả.
- **`dynamicStableScale: true`:** bật để ReplicaSet stable cũng scale giảm
  theo tỉ lệ (`ceil(weight × replicas / 100)`), tiết kiệm tài nguyên hơn so
  với mặc định (stable giữ nguyên 100% Pod suốt canary) — đánh đổi: `abort`
  không còn tức thì 100%, cần vài giây scale ngược lại.
- **Rollback đúng chuẩn GitOps:** không dùng `kubectl argo rollouts undo`
  cho rollback lâu dài nếu đang bật `selfHeal` — ArgoCD sẽ tự sync đè lại
  theo Git gần như ngay lập tức. Cách đúng: revert commit đổi tag trong
  `values.yaml`, để Git luôn là nguồn sự thật.
- **Readiness probe không nên trỏ vào trang chủ:** dùng route tĩnh riêng
  (`/api/ping` bên frontend) thay vì `/`, để tránh probe tự kích hoạt SSR
  render + gọi backend mỗi `periodSeconds`, gây nhiễu traffic thật.