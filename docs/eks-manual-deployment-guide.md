# Hướng dẫn triển khai app lên AWS EKS (thao tác tay trên console)

Tài liệu này hướng dẫn dựng toàn bộ hạ tầng EKS từ đầu bằng tay trên AWS
Console, để hiểu rõ cơ chế hoạt động của từng thành phần trước khi tự động
hoá bằng Terraform ở giai đoạn sau. Áp dụng cho chart
`helm/electronics-shop-eks` (bản Postgres/MinIO đã chuyển sang RDS/S3, dùng
Argo Rollouts + Traefik + KEDA + kube-prometheus-stack).

**Lưu ý về Traefik**: app chính (`electronics-shop`) dùng Traefik
(IngressRoute/TraefikService) đứng sau 1 **NLB** riêng để canary chia % traffic
thật cho Argo Rollouts — KHÔNG dùng chung ALB Ingress Controller với 5 domain
giám sát/quản trị còn lại (argocd, grafana, prometheus, alertmanager,
rollouts). Xem `traefik/traefik-values-eks.yaml` để hiểu lý do, và Phần 21 để
biết domain `app` trỏ DNS về đâu (khác 5 domain kia).

**Trước khi bắt đầu:**
- Đã có tài khoản AWS, đã cài `aws cli` + `kubectl` + `helm` trên máy và aws cli đã được cấu hình (aws configure) với IAM user/role có toàn quyền thao tác với các dịch vụ hoặc tài nguyên trên AWS.
- Chọn 1 region cho toàn bộ hạ tầng — tài liệu dùng `ap-southeast-1`
  (Singapore), đổi lại nếu bạn dùng region khác.
- Domain dùng xuyên suốt tài liệu: `techshop-tde.dynv6.net` (miễn phí qua
  dynv6.com — xem Phần 14). Đổi lại theo domain thật của bạn ở mọi chỗ xuất
  hiện.

---

## Phần 1 — VPC & Subnet

1. **VPC → Create VPC → VPC and more**.
2. Cấu hình:
   - Name tag: `techshop`
   - IPv4 CIDR: `10.0.0.0/16`
   - Number of Availability Zones: **2**
   - Number of public subnets: **2**
   - Number of private subnets: **2**
   - NAT gateways: **In 1 AZ** (tiết kiệm chi phí lúc test)
   - VPC endpoints: **None**
3. **Create VPC**.

### Gắn tag cho subnet (bắt buộc — AWS Load Balancer Controller cần để biết đặt ALB vào đâu)

- Vào từng **subnet public** → tab **Tags** → thêm:
  ```
  kubernetes.io/role/elb = 1
  ```
- Vào từng **subnet private** → tab **Tags** → thêm:
  ```
  kubernetes.io/role/internal-elb = 1
  ```

Ghi lại: **VPC ID**, 2 **Subnet ID public**, 2 **Subnet ID private** — dùng
lại ở nhiều bước sau.

---

## Phần 2 — IAM Role cho Cluster và cho Node

### A. Role cho Control Plane

1. **IAM → Roles → Create role → AWS service → EKS → EKS - Cluster**.
2. Policy tự gắn sẵn: `AmazonEKSClusterPolicy`.
3. Name: `techshop-eks-cluster-role`.

### B. Role cho Worker Node

1. **IAM → Roles → Create role → AWS service → EC2**.
2. Gắn đúng 3 policy:
   - `AmazonEKSWorkerNodePolicy`
   - `AmazonEKS_CNI_Policy`
   - `AmazonEC2ContainerRegistryReadOnly`
3. Name: `techshop-eks-node-role`.

Ghi lại ARN của cả 2 role.

---

## Phần 3 — Tạo EKS Cluster

1. **EKS → Clusters → Create cluster → Custom configuration**.
2. **Configure cluster**:
   - EKS Auto Mode: Off
   - Name: `techshop-cluster`
   - Kubernetes version: mới nhất được hỗ trợ
   - Cluster service role: `techshop-eks-cluster-role`
3. **Networking**: chọn đúng VPC, tick cả 4 subnet (2 public + 2 private).
   Cluster endpoint access: **Public and private**. Mục **Additional
   security groups**: **để trống, không chọn gì** — EKS sẽ tự sinh ra 1
   "cluster security group" riêng, tự động gắn vào mọi worker node sau này
   (dùng lại chính SG này ở Phần 4 khi mở inbound cho RDS).
4. **Add-ons**: giữ nguyên các add-ons mặc định đã được tick sẵn.
   - Ở bước "Configure selected add-ons settings" — bật Prefix Delegation ngay tại đây, giữ nguyên `kube-proxy`, `CoreDNS` và các add-ons khác. Với **Amazon VPC CNI**,
   bấm vào để mở rộng → mục **Optional configuration settings**, dán:
   ```json
   {
     "env": {
       "ENABLE_PREFIX_DELEGATION": "true"
     }
   }
   ```
   *(Bật ngay từ đầu vì mặc định mỗi node chỉ chạy được rất ít pod —
   t3.medium chỉ 17 pod/node, tính theo số IP ENI cấp được — không đủ chỗ
   cho ArgoCD + kube-prometheus-stack + KEDA + Argo Rollouts + app cùng
   lúc. Prefix Delegation cho phép 1 ENI cấp cả dải /28 (16 IP) ở 1 lần cấp thay vì từng IP lẻ, tăng mạnh số pod/node.)*
5. **Create** — đợi 10-15 phút tới khi **Active**.

---

## Phần 4 — RDS Postgres (dùng Secrets Manager)

### A. DB Subnet Group

1. **RDS → Subnet groups → Create DB subnet group**.
2. Name: `techshop-db-subnet-group`, chọn đúng VPC, chọn 2 **subnet private**.

### B. Security Group cho RDS

1. **EC2 → Security Groups → Create security group**.
2. Name: `techshop-rds-sg`, chọn đúng VPC.
3. **Chưa thêm inbound rule vội** — vì Security Group của node EKS chỉ có
   sau khi tạo cluster xong (Phần 3 đã xong, cluster đã có 1 Security Group
   tự sinh — gọi là "cluster security group", tự động gắn vào mọi worker
   node sau này). Vào **EKS → cluster `techshop-cluster` → tab Networking**,
   copy ID của **Cluster security group**.
4. Quay lại `techshop-rds-sg` → **Inbound rules → Add rule**:
   - Type: **PostgreSQL** (tự điền port 5432)
   - Source: **Custom** → dán đúng **Cluster security group ID** vừa copy
     (không dùng CIDR VPC — thắt chặt ngay từ đầu, đúng nguyên tắc chỉ đúng
     node EKS mới gọi được vào RDS).
5. Save.

### C. Tạo RDS Instance

1. **RDS → Databases → Create database → Full configuration**.
2. Engine: **PostgreSQL** (chọn version khớp bản Postgres bạn dùng local hoặc 18.3).
3. Templates: **Production**.
4. Availability and durability: **Single-AZ DB instance deployment** (tiết kiệm chi phí khi test).
5. Settings: DB instance identifier `techshop-postgres`, đặt Master
   username tuỳ ý. Mục **Credentials management**: chọn
   **Manage master credentials in AWS Secrets Manager** ngay tại đây (không
   chọn Self managed) — Encryption key: **aws/secretsmanager**. AWS tự sinh
   password rotation ngẫu nhiên và tạo sẵn secret, giúp bảo mật hơn và không cần ta nhớ cứng 1 password.
6. Instance: `db.m5.large`. Storage: `gp3`, 20GB.
7. Connectivity: đúng VPC, DB subnet group `techshop-db-subnet-group`,
   **Public access: No**, VPC security group: **Choose existing** →
   `techshop-rds-sg`.
8. Additional configuration: Initial database name `electronics_shop`, Backup: 1-7 ngày tuỳ ý.
9. **Create database** — đợi 5-10 phút tới **Available**.
10. Sau khi xong, vào lại instance → tab **Configuration** → copy **Master
   credentials ARN** (dạng `arn:aws:secretsmanager:...:secret:rds!db-...`).

Ghi lại: **RDS Endpoint** (tab Connectivity & security) và **Master
credentials ARN**.

---

## Phần 5 — S3 Bucket

1. **S3 → Create bucket**.
2. Name: `techshop-images-bk` (phải là tên duy nhất toàn cầu, đổi lại nếu
   trùng).
3. Region: đúng region đang dùng.
4. **Block Public Access: giữ nguyên BẬT** (bucket private hoàn toàn —
   frontend đọc qua route proxy `/api/images/[...key]` dùng IRSA, không
   public trực tiếp bucket).
5. **Create bucket**.

Ghi lại: **tên bucket**, **region**.

---

## Phần 6 — Tạo 3 IAM Policy

**IAM → Policies → Create policy → JSON**, tạo lần lượt 3 policy sau:

### `techshop-s3-backend-policy`
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::techshop-images-bk/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::techshop-images-bk"
    }
  ]
}
```

### `techshop-secrets-manager-policy`
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:ap-southeast-1:<ACCOUNT_ID>:secret:rds!db-*"
    }
  ]
}
```

### `techshop-s3-frontend-read-policy`
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::techshop-images-bk/*"
    }
  ]
}
```

**Kiểm tra kỹ đúng tên bucket** ở cả 2 policy đầu và cuối — gõ nhầm tên bucket là lỗi
rất dễ gặp (S3 SDK báo `UnknownError` mù mờ thay vì `AccessDenied` rõ ràng
khi dính lỗi này).

---

## Phần 7 — OIDC Identity Provider

1. **EKS → cluster `techshop-cluster` → tab Overview** → copy **OpenID
   Connect provider URL**.
2. **IAM → Identity providers** → nếu đã có provider trùng URL thì bỏ qua;
   nếu chưa, **Add provider → OpenID Connect** → dán URL → **Get
   thumbprint** → Audience `sts.amazonaws.com` → **Add provider**.

Đây là "vật trung gian tin cậy" để AWS chấp nhận token do chính cluster này
phát hành — không có bước này thì không có IRSA nào hoạt động được.

---

## Phần 8 — 2 IAM Role cho IRSA (backend, frontend)

### `techshop-backend-irsa-role`

1. **IAM → Roles → Create role → Web identity** → chọn OIDC provider vừa
   tạo → Audience `sts.amazonaws.com`.
2. Gắn **cả 2** policy: `techshop-s3-backend-policy` +
   `techshop-secrets-manager-policy`.
3. Name: `techshop-backend-irsa-role`.
4. Create role
5. Vào role vừa tạo →tab **Trust relationships → Edit trust policy**, sửa lại:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/oidc.eks.ap-southeast-1.amazonaws.com/id/<CLUSTER_ID>"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.eks.ap-southeast-1.amazonaws.com/id/<CLUSTER_ID>:aud": "sts.amazonaws.com",
          "oidc.eks.ap-southeast-1.amazonaws.com/id/<CLUSTER_ID>:sub": "system:serviceaccount:electronics-shop:backend-sa"
        }
      }
    }
  ]
}
```

### `techshop-frontend-irsa-role`

Lặp lại y hệt, đổi:
- Policy gắn: `techshop-s3-frontend-read-policy`.
- Name: `techshop-frontend-irsa-role`.
- `:sub` trong trust policy: `system:serviceaccount:electronics-shop:frontend-sa`.

Ghi lại ARN của cả 2 role — dùng để điền vào
`helm/electronics-shop-eks/values-eks.yaml` (`serviceAccount.backend.roleArn`
/ `serviceAccount.frontend.roleArn`) ở Phần 18.

---

## Phần 9 — Managed Node Group

*(Không cần Launch Template — Prefix Delegation ở Phần 3 đã giải quyết vấn
đề số pod/node rồi.)*

1. **EKS → cluster → tab Compute → Add node group**.
2. Node IAM role: `techshop-eks-node-role`.
3. AMI: Amazon Linux 2023. Capacity type: **On-Demand**.
4. Instance type: `t3.medium`. Disk: 20GB.
5. Scaling: min **2**, desired **2**, max **3**.
6. Networking: chọn **2 subnet private**. SSH access: **Disable**.
7. **Create** — đợi 3-5 phút tới **Active**.

---

## Phần 10 — Kết nối kubectl và verify

```bash
aws eks update-kubeconfig --region ap-southeast-1 --name techshop-cluster
kubectl get nodes -o wide          # phải thấy 2 node Ready
kubectl get pods -A                # coredns/kube-proxy/aws-node đều Running
kubectl create namespace electronics-shop
```

Nếu gặp `Unauthorized`: Vào IAM, tìm và chọn đúng IAM User/Role đang dùng với `aws cli`, gắn
policy `AmazonEKSClusterAdminPolicy`.

---

## Phần 11 — IAM cho AWS Load Balancer Controller & EBS CSI Driver

### A. `AWSLoadBalancerControllerIAMPolicy` + `techshop-alb-controller-role`

```bash
curl -O https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json

aws iam create-policy \
  --policy-name AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://iam_policy.json
```

Tạo role giống Phần 8 (Web identity, cùng OIDC provider), gắn policy vừa
tạo, name `techshop-alb-controller-role`, sửa trust policy `:sub` thành
`system:serviceaccount:kube-system:aws-load-balancer-controller`.

### B. `techshop-ebs-csi-role` (dùng policy `AmazonEBSCSIDriverPolicy`)

Tạo role giống hệt cách trên, nhưng dùng policy **có sẵn**
`AmazonEBSCSIDriverPolicy` (không cần tự viết JSON), name
`techshop-ebs-csi-role`, `:sub` = `system:serviceaccount:kube-system:ebs-csi-controller-sa`.

Ghi lại ARN của 2 role này — dùng khi chạy `scripts/install-eks-tools.sh`
(Phần 19).

---

## Phần 12 — EC2 cho Harbor

### A. Tạo Security Group trước

1. **EC2 → Security Groups → Create security group**.
2. Name: `harbor-sg`, chọn đúng VPC.
3. Inbound rules:
   - Port 80 (HTTP) — Source: `0.0.0.0/0` (Let's Encrypt cần xác minh được
     từ mọi nơi)
   - Port 443 (HTTPS) — Source: `0.0.0.0/0`
   - Port 22 (SSH) — Source: **IP của bạn** (không mở `0.0.0.0/0`)
4. **Create security group**.

### B. Launch EC2

1. **EC2 → Launch instance**.
2. Name: `techshop-harbor`. AMI: **Ubuntu Server 24.04 LTS**.
3. Instance type: `t3.medium`.
4. Storage: **20GB, gp3**.
5. Network: đặt trong **public subnet**, Auto-assign public IP: **Enable**
   (khuyến nghị gắn thêm **Elastic IP** để IP không đổi khi stop/start).
6. Security Group: chọn **Select existing security group** → `harbor-sg`
   vừa tạo (không để EC2 tự tạo SG mới).
7. Launch, chọn/tạo key pair `.pem`, tải về.

---

## Phần 13 — EC2 cho Bastion (seed DB + thao tác với RDS)

### A. Tạo Security Group trước

1. **EC2 → Security Groups → Create security group**.
2. Name: `bastion-host-sg`, chọn đúng VPC.
3. Inbound rules:
   - Port 22 (SSH) — Source: **IP của bạn**
4. **Create security group**.

### B. Launch EC2

1. **EC2 → Launch instance**.
2. Name: `techshop-bastion`. AMI: **Ubuntu Server 24.04 LTS**.
3. Instance type: `t3.micro`.
4. Storage: mặc định (**8GB gp3**).
5. Network: public subnet, Auto-assign public IP: **Enable**.
6. Security Group: chọn **Select existing security group** → `bastion-host-sg`
   vừa tạo.
7. Launch, dùng lại hoặc tạo key pair riêng.

### C. Mở thêm rule ở Security Group của RDS

Vào lại `techshop-rds-sg` (Phần 4.B) → **Inbound rules → Add rule** (**thêm
mới**, không xoá rule cũ đang cho phép cluster security group của EKS):
- Type: PostgreSQL, Source: **Custom** → chọn `bastion-host-sg` (SG vừa tạo
  ở mục A) → **Save rules**.

---

## Phần 14 — Đăng ký domain miễn phí trên dynv6

1. Vào **dynv6.com** → đăng ký tài khoản.
2. **My Zones → Create Zone** → đặt tên `techshop-tde.dynv6.net`.

---

## Phần 15 — Tạo chứng chỉ ACM (wildcard)

1. **Certificate Manager (ACM)** — đúng region với EKS/ALB.
2. **Request a public certificate**.
3. Fully qualified domain name: `*.techshop-tde.dynv6.net`.
4. Validation: **DNS validation**.
5. **Request**.

### Xác thực quyền sở hữu qua DNS

1. Vào chứng chỉ vừa tạo → copy **CNAME name** và **CNAME value** ACM sinh
   ra.
2. Vào dynv6 → zone `techshop-tde.dynv6.net` → **Add Record** → tạo CNAME
   với đúng Name/Value đó — **phải có dấu chấm `.` ở cuối Value** (thiếu
   dấu chấm sẽ bị dynv6 tự nối thêm tên zone vào sau, DNS sai, xác thực
   fail).
3. Đợi vài phút, ACM tự chuyển sang **Issued**.

Ghi lại **ARN chứng chỉ** — dùng ở Phần 19 (script hỏi lúc chạy, không viết
cứng vào file).

---

## Phần 16 — Cài Harbor qua script

Từ **WSL2** (hoặc máy Linux/macOS có `rsync`), chạy:

```bash
bash scripts/setup-harbor-ec2.sh
```

Script sẽ hỏi: địa chỉ SSH vào EC2 Harbor, đường dẫn `.pem`, Harbor version,
email đăng ký Let's Encrypt, mật khẩu admin/DB Harbor — **rồi dừng lại yêu
cầu bạn tạo DNS record trước khi tiếp tục**:

1. Script in ra Public IP thật của EC2 Harbor.
2. Vào dynv6 → tạo **A record**: Name `harbor`, Data = IP đó.
3. Đợi lan truyền, `dig +short harbor.techshop-tde.dynv6.net` ra đúng IP.
4. Quay lại terminal, nhập domain `harbor.techshop-tde.dynv6.net`, script
   tiếp tục tự cài Docker + xin cert Let's Encrypt + cài Harbor
   (`--with-trivy`) + cron gia hạn cert.

Xong, truy cập `https://harbor.techshop-tde.dynv6.net`.

---

## Phần 17 — Tạo Project, Robot Account, cấu hình GitHub

### A. Trên UI Harbor

1. Đăng nhập `admin` / mật khẩu vừa đặt.
2. **Projects → New Project** → tên `electronics-shop` → **Private**.
3. Vào project → tab **Robot Accounts → New Robot Account** → tên `ci-cd`,
   quyền **Push + Pull Repository** → copy lại **username** và **token** (chỉ
   hiện 1 lần duy nhất).

### B. Trên GitHub repo

**Settings → Secrets and variables → Actions**:

Tab **Secrets**:
| Name | Value |
|---|---|
| `HARBOR_REGISTRY` | `harbor.techshop-tde.dynv6.net` |
| `HARBOR_ROBOT_USER` | `robot$electronics-shop+ci-cd` (username Harbor vừa cấp) |
| `HARBOR_ROBOT_TOKEN` | Token vừa copy |
| `NEXT_PUBLIC_API_URL` | `https://app.techshop-tde.dynv6.net/api/v1` |

*(`HARBOR_CA_CERT` — để trống/không cần set, vì Harbor dùng Let's Encrypt,
CA đã được các máy client/CI tin cậy sẵn, không phải self-signed.)*

Tab **Variables**:
| Name | Value |
|---|---|
| `HELM_VALUES_FILE` | `helm/electronics-shop-eks/values.yaml` |

---

## Phần 18 — Test CI/CD ghi đúng tag vào chart mới

Cập nhật image tag mới vào chart `electronics-shop-eks`:

```bash
# sửa 1 dòng comment nhỏ trong backend/ và frontend/ (không đổi logic gì)
git add backend/ frontend/
git commit -m "chore: test CI/CD update tag to electronics-shop-eks chart"
git push origin main
```

Theo dõi tab **Actions** trên GitHub, xác nhận pipeline chạy xong và
`backendTag`/`frontendTag` được ghi đúng vào
`helm/electronics-shop-eks/values.yaml`.

---

## Phần 19 — Cài các tool nền tảng lên cluster

```bash
bash scripts/install-eks-tools.sh
```

Chạy **hết toàn bộ script tới khi kết thúc**, không dừng giữa chừng — script
tự dừng đúng 2 lúc cần ta thao tác tay rồi tự tiếp tục:

1. Hỏi lần lượt: Cluster name, Region, VPC ID, ARN role ALB Controller
   (Phần 11.A), ARN role EBS CSI Driver (Phần 11.B), ARN chứng chỉ ACM
   (Phần 15).
2. Tự cài AWS Load Balancer Controller, EBS CSI Driver + StorageClass
   `gp3`.
3. **Dừng lần 1**: yêu cầu copy `kube-prometheus-stack-values-eks-example.yaml`
   → `kube-prometheus-stack-values-eks.yaml`, điền `adminPassword` Grafana +
   email Alertmanager, rồi script hỏi thêm Gmail App Password — điền xong
   nhấn Enter, script tự cài kube-prometheus-stack (**Ingress của Grafana/
   Prometheus/Alertmanager bật ngay tại bước này — ALB đã được AWS tạo ra từ đây**).
4. Tự cài KEDA, Argo Rollouts, Traefik.
5. **Dừng lần 2**: yêu cầu copy `argocd-application-eks.example.yaml` →
   `argocd-application-eks.yaml`, điền đủ giá trị AWS thật vào
   `valuesObject` (`rds.host`, `secretsManager.dbSecretArn`, `s3.bucket`,
   `s3.region`, `serviceAccount.backend/frontend.roleArn`, `ingress.host`,
   `ingress.alb.certificateArn`, `harborAuth`) — điền xong nhấn Enter, script
   tự cài Argo CD **và tự `kubectl apply` luôn Application** ở bước cuối
   cùng — không cần bạn tự `apply` gì thêm sau khi script chạy xong.

---

## Phần 20 — Seed dữ liệu vào RDS + Upload ảnh lên S3

### A. Seed qua bastion

```bash
bash scripts/seed-rds-via-bastion.sh
```

Script hỏi: địa chỉ SSH bastion (Phần 13), đường dẫn `.pem`, đường dẫn thư
mục `backend/` trên máy host, RDS endpoint (Phần 4), user/pass DB (lấy qua
`aws secretsmanager get-secret-value --secret-id <ARN> --query SecretString
--output text`), tên DB — tự `rsync` code, cài Node.js, chạy seed với
`STORAGE_PROVIDER=aws` (để URL ảnh sinh ra đúng dạng `/api/images/{key}`
thay vì URL MinIO).

### B. Upload ảnh khớp đúng key trong seed

Mở `backend/src/database/seeds/product.seed.ts`, đối chiếu từng `key` (ví
dụ `products/iphone17promax/1.jpg`) → **S3 Console → bucket
`techshop-images-bk` → Upload** → tạo đúng cấu trúc thư mục/tên file khớp
chính xác từng key đó.

Hoặc, download các ảnh mẫu có sẵn từ Google Drive có đường dẫn được đặt tại `docs/image-assets.txt`, rồi upload lên bucket `techshop-images-bk` trên S3.

---

## Phần 21 — Tạo DNS cho 6 domain (ArgoCD, Grafana, App, Prometheus, Alertmanager, Rollouts)

Vì Phần 19 đã cài xong mọi thứ (kube-prometheus-stack + Traefik + Argo CD
Application đều đã tự apply), cả ALB lẫn NLB đã tồn tại sẵn — chỉ cần lấy DNS
Name của **đúng loại Load Balancer cho từng domain** và tạo CNAME, **không
cần apply gì thêm**:

**QUAN TRỌNG**: domain `app` KHÔNG dùng chung Load Balancer với 5 domain còn
lại — `app` trỏ vào Service của Traefik (đứng sau **NLB**, xem
`traefik/traefik-values-eks.yaml`), trong khi `argocd`/`grafana`/
`prometheus`/`alertmanager`/`rollouts` vẫn trỏ vào **ALB** do AWS Load
Balancer Controller tạo ra như cũ (Ingress thường). Lấy nhầm DNS Name của ALB
rồi trỏ CNAME `app` vào đó sẽ khiến domain `app` không hoạt động, vì Ingress
của app giờ đã đổi sang IngressRoute do Traefik quản lý, không còn thuộc ALB
Controller nữa.

1. Lấy DNS Name của **NLB** (dùng riêng cho `app`):
   ```bash
   kubectl get svc traefik -n traefik
   ```
   (cột `EXTERNAL-IP` chính là DNS Name của NLB; hoặc **EC2 → Load
   Balancers** trên console, tìm NLB có tag gắn với Service `traefik` trong
   namespace `traefik`)
2. Lấy DNS Name của **ALB** (dùng chung cho 5 domain còn lại):
   ```bash
   kubectl get ingress -A
   ```
   (hoặc **EC2 → Load Balancers** trên console, tìm ALB tên
   `k8s-techshopshared-...`, cột **DNS name**)
3. Vào dynv6 → zone `techshop-tde.dynv6.net` → tạo lần lượt 6 **CNAME**,
   **Data = đúng DNS Name tương ứng + dấu chấm `.` ở cuối**:

| Name | Type | Data |
|---|---|---|
| `app` | CNAME | `<DNS Name của NLB (traefik)>.` |
| `argocd` | CNAME | `<DNS Name của ALB>.` |
| `grafana` | CNAME | `<DNS Name của ALB>.` |
| `prometheus` | CNAME | `<DNS Name của ALB>.` |
| `alertmanager` | CNAME | `<DNS Name của ALB>.` |
| `rollouts` | CNAME | `<DNS Name của ALB>.` |

4. Đợi vài phút, verify bằng `nslookup app.techshop-tde.dynv6.net` — kết
   quả `canonical name` phải dừng đúng ở `...elb.amazonaws.com.` (NLB cũng ra
   domain dạng này), không dính thêm đuôi zone phía sau (nếu dính thêm đuôi,
   nghĩa là quên dấu chấm ở bước 3).

---

## Phần 22 — Tạo GitHub Webhook cho Argo CD

1. GitHub repo → **Settings → Webhooks → Add webhook**.
2. Payload URL: `https://argocd.techshop-tde.dynv6.net/api/webhook`.
3. Content type: `application/json`.
4. Sự kiện: **Just the push event** là đủ.
5. **Add webhook**.

*(Webhook giúp ArgoCD phát hiện thay đổi gần như ngay lập tức thay vì phải
đợi chu kỳ polling mặc định — không bắt buộc để app chạy được, nhưng nên có
để trải nghiệm CI/CD mượt hơn.)*

---

## Phần 23 — Đồng bộ Argo CD, kiểm tra app

1. Mở `https://argocd.techshop-tde.dynv6.net`.
2. Đăng nhập — lấy password admin mặc định:
   ```bash
   kubectl -n argocd get secret argocd-initial-admin-secret \
     -o jsonpath="{.data.password}" | base64 -d
   ```
3. Vào Application `electronics-shop` → bấm **SYNC** (thủ công lần đầu) —
   theo dõi tới khi tất cả resource chuyển **Healthy** + **Synced**.
4. Sau khi app chạy ổn định vài ngày không sự cố, bật tự động đồng bộ: mở
   `argo/argocd-application-eks.yaml`, bỏ comment khối:
   ```yaml
   automated:
     selfHeal: true
     prune: true
   ```
   rồi `kubectl apply -f argo/argocd-application-eks.yaml`.

---

## Phần 24 — Kiểm tra app hoạt động

Mở `https://app.techshop-tde.dynv6.net` — kiểm tra trang chủ load được sản
phẩm, ảnh hiển thị đúng (lấy từ S3 qua route proxy), đăng ký/đăng nhập hoạt
động (kết nối RDS qua Secrets Manager), thêm giỏ hàng/đặt hàng chạy được.

---

## Phần 25 — Bảo mật lại sau khi test xong

**Việc bắt buộc phải làm** — 5 domain giám sát/quản trị (`argocd`,
`grafana`, `prometheus`, `alertmanager`, `rollouts`) chỉ nên public tạm thời
để test ALB route đúng. Sau khi xác nhận hoạt động tốt, tắt Ingress của cả
5:

1. Trong `argo/argocd-server-values-eks.yaml`: đổi `enabled: true` →
   `enabled: false` (mục `server.ingress`).
2. Trong `argo/argo-rollouts-values-eks.yaml`: tương tự với `ingress.enabled`.
3. Trong `monitoring/kube-prometheus-stack-values-eks.yaml`: đổi
   `ingress.enabled: false` ở cả 3 mục `prometheus`/`alertmanager`/`grafana`.
4. Áp dụng lại:
   ```bash
   helm upgrade --install argocd argo/argo-cd -n argocd -f argo/argocd-server-values-eks.yaml
   helm upgrade --install argo-rollouts argo/argo-rollouts -n argo-rollouts -f argo/argo-rollouts-values-eks.yaml
   helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack -n monitoring -f monitoring/kube-prometheus-stack-values-eks.yaml
   ```
5. Xoá luôn 5 CNAME tương ứng trên dynv6 (không bắt buộc, nhưng dọn cho
   sạch — domain trỏ vào Ingress không còn tồn tại sẽ chỉ báo lỗi, không
   rủi ro bảo mật gì thêm nếu để lại).

**Từ giờ, muốn xem dashboard của công cụ nào thì dùng `kubectl
port-forward`, không public ra internet nữa:**

```bash
kubectl port-forward -n argocd svc/argocd-server 8080:443
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
kubectl port-forward -n monitoring svc/kube-prometheus-stack-alertmanager 9093:9093
kubectl argo rollouts dashboard -n electronics-shop
```

Chỉ giữ lại `app.techshop-tde.dynv6.net` (frontend + `/api` backend) public
ra internet — đây là thứ duy nhất người dùng thật cần truy cập. Lưu ý domain
này KHÔNG tắt/bật theo cùng cơ chế `ingress.enabled` như 5 domain ALB ở
trên — nó chạy qua **IngressRoute (Traefik) + NLB riêng** (xem Phần 21), nên
không nằm trong 4 bước tắt Ingress phía trên và không cần (cũng không nên)
đụng vào cấu hình Traefik ở bước này.

---

## Bảng tra cứu nhanh — các lỗi đã gặp
 
| Triệu chứng | Nguyên nhân thật | Cách sửa |
|---|---|---|
| Pod `Pending`, `0/2 nodes are available: 2 Too many pods` | **Không phải thiếu CPU/RAM** — EKS giới hạn số pod/node theo số IP mà ENI cấp được (t3.medium mặc định chỉ 17 pod/node) | Bật `ENABLE_PREFIX_DELEGATION: true` cho add-on VPC CNI (Phần 3) |
| `helm install` báo `cannot re-use a name that is still in use` khi chạy lại script sau khi bị timeout | `helm install` không idempotent — chạy lại lần 2 với release đã tồn tại sẽ lỗi | Luôn dùng `helm upgrade --install` thay vì `helm install` |
| ALB Target Group báo Unhealthy cho Prometheus/Grafana/Argo Rollouts Dashboard, dù pod vẫn `Running` | 3 dịch vụ này tự redirect `/` sang path khác (302) — ALB mặc định chỉ coi HTTP 200 là Healthy | Set `alb.ingress.kubernetes.io/healthcheck-path` đúng endpoint riêng (`/-/healthy` cho Prometheus, `/api/health` cho Grafana) hoặc `success-codes: '200,302'` nếu không có endpoint riêng |
| Browser báo `DNS_PROBE_FINISHED_NXDOMAIN` dù đã tạo đúng CNAME trỏ DNS Name của ALB | Thiếu dấu chấm `.` ở cuối giá trị CNAME — DNS hiểu là tên tương đối, tự nối thêm tên zone vào sau (`...elb.amazonaws.com.techshop-tde.dynv6.net`, không tồn tại) | Thêm dấu chấm `.` vào cuối giá trị CNAME |
| ArgoCD Application sync lỗi `no matches for kind "Rollout"`/`"ScaledObject"`/`"TraefikService"` | Cài ArgoCD trước, CRD của Argo Rollouts/KEDA/Traefik chưa tồn tại lúc Application cố sync | Cài đủ AWS LB Controller, EBS CSI, kube-prometheus-stack, KEDA, Argo Rollouts, Traefik **trước**, cài ArgoCD **sau cùng** (xem thứ tự trong `scripts/install-eks-tools.sh`) |
| Rollout không chuyển traffic canary sang bản mới dù step `setWeight` đã chạy, hoặc `rollouts` dashboard báo weight đúng nhưng thực tế 100% traffic vẫn vào bản cũ | (1) Chưa cài Traefik nên CRD `TraefikService` không tồn tại, Rollout không có gì để ghi weight vào; hoặc (2) đã bật `automated.selfHeal: true` trong Argo CD Application nhưng thiếu khối `ignoreDifferences` cho `TraefikService` — Self Heal liên tục kéo weight về giá trị cũ trong Git | (1) Cài Traefik trước khi Sync app (Phần 19); (2) đảm bảo `argocd-application-eks.yaml` có đủ khối `ignoreDifferences` cho `group: traefik.io` và `group: traefik.containo.us`, `kind: TraefikService`, path `/spec/weighted/services/*/weight` |
| Truy cập `http://app.techshop-tde.dynv6.net/` (HTTP, cổng 80) load bình thường, nhưng `https://app...` (HTTPS, cổng 443, qua NLB) báo `404 page not found` | `IngressRoute` (`backend-canary-route`, `frontend-canary-route`) chỉ khai `entryPoints: [web]` — "web" (80) và "websecure" (443) là 2 entrypoint RIÊNG BIỆT của Traefik, không tự gộp chung. NLB giải mã TLS rồi forward request HTTPS thật vào entrypoint `websecure`, nhưng route chỉ lắng nghe entrypoint `web` nên không router nào khớp → Traefik tự trả 404 (không phải 404 của Next.js/backend), dù `match`/`services` khai đúng | Thêm `websecure` vào `entryPoints` của cả 2 `IngressRoute` trong `helm/electronics-shop-eks/templates/backend-traffic.yaml` và `frontend-traffic.yaml` (`entryPoints: [web, websecure]`), rồi `helm upgrade`/Sync lại Argo CD |
| Đã thêm `websecure` vào `entryPoints` như trên, `helm upgrade`/Sync lại đàng hoàng, nhưng `https://app...` **vẫn** báo `404 page not found` y hệt | Chart gốc của Traefik tự bật `http.tls.enabled: true` MẶC ĐỊNH cho riêng entrypoint tên `websecure` (xem https://doc.traefik.io/traefik/setup/kubernetes/). NLB đã giải mã TLS bằng ACM rồi forward HTTP THUẦN vào cổng `websecure`, nhưng Traefik ở cổng đó vẫn tự chờ nhận TLS ClientHello — 2 bên lệch giao thức khiến kết nối bị đóng/lỗi ngay từ tầng TLS, KHÔNG BAO GIỜ chạm tới bước so khớp router, nên vẫn thấy 404 (hoặc lỗi kết nối tuỳ trình duyệt) dù `entryPoints` đã đúng | Trong `traefik/traefik-values-eks.yaml`, thêm `ports.websecure.http.tls.enabled: false` (Traefik không cần tự làm TLS lần 2 vì NLB đã lo phần đó), rồi `helm upgrade --install traefik traefik/traefik -n traefik -f traefik/traefik-values-eks.yaml ...` lại (release `traefik`, khác với release app chính) |
| `helm upgrade --install traefik ...` báo `Error: UPGRADE FAILED: values don't meet the specifications of the schema(s)... traefik: - at '/ports/websecure': additional properties 'tls' not allowed` | Đặt sai vị trí field: `tls` KHÔNG nằm trực tiếp dưới `ports.websecure` — chart Traefik (bản `41.x`, Proxy v3.7.x) lồng field này bên trong `http` (`ports.websecure.http.tls.enabled`), không phải `ports.websecure.tls.enabled`. Đặt sai vị trí bị `values.schema.json` của chart chặn ngay lúc `helm upgrade` (`additionalProperties: false`) | Sửa lại đúng lồng cấp: `ports.websecure.http.tls.enabled: false` (xem `traefik/traefik-values-eks.yaml`). Nếu vẫn báo lỗi tương tự sau khi sửa đúng, kiểm tra version chart đang cài bằng `helm list -n traefik` (cột `CHART`), rồi `helm show values traefik/traefik --version <version>` để đối chiếu đúng field cho đúng version đó — cấu trúc `ports.<name>` có thể khác nhau giữa các version chart |
| Rollout báo lỗi cấu hình liên quan `dynamicStableScale` | `dynamicStableScale: true` chỉ hợp lệ khi có khai báo `trafficRouting` đi kèm — bỏ trafficRouting mà quên bỏ luôn dòng này | Comment lại `dynamicStableScale` khi không dùng `trafficRouting` |
| Backend log `ECONNREFUSED` liên tục khi kết nối DB | `ConfigModule` với `load` async bị race condition — `TypeOrmModule` đọc giá trị config trước khi Promise gọi Secrets Manager resolve xong, `DB_HOST` rơi về fallback `'localhost'` | Gọi Secrets Manager **trực tiếp trong `useFactory`** của `TypeOrmModule.forRootAsync` (Nest đảm bảo await xong trước khi dùng), không qua `configuration.ts` |
| Backend log `no pg_hba.conf entry for host ... no encryption` | RDS PostgreSQL mặc định bắt buộc SSL (`rds.force_ssl=1`), code kết nối không bật SSL | Thêm `ssl: { ca: <RDS CA bundle>, rejectUnauthorized: true }` vào cấu hình TypeORM khi dùng Secrets Manager |
| `StorageService` log `❌ Không thể kết nối AWS S3: UnknownError`, dù tên bucket/region đúng trên console | IAM Policy gõ nhầm tên bucket khác với bucket thật đang dùng — implicit deny hiển thị lỗi mù mờ (`UnknownError`) thay vì `AccessDenied` rõ ràng | Đối chiếu kỹ lại `Resource` trong policy đúng khớp tên bucket thật |
| Next.js Image báo `isn't a valid image for /api/images/... received null` | **2 nguyên nhân riêng biệt cần loại trừ lần lượt**: (1) Ingress route `/api` (Prefix) khớp luôn cả `/api/images/...`, forward nhầm sang backend (backend không có route này, trả 404) — kiểm tra bằng cách xem log pod, nếu **không có log gì** dù lỗi vẫn xảy ra thì đúng nguyên nhân này; (2) Next.js Image Optimization tự fetch lại chính nó qua ALB bị chặn (hairpin NAT) | (1) Đặt rule `/api/images` **trước** rule `/api` trong Ingress, và loại trừ `images`/`ping` khỏi rewrite proxy trong `next.config.js`; (2) Thêm `unoptimized={isApiImageProxyUrl(url)}` vào các `<Image>` render ảnh từ route proxy |
| `next.config.js` rewrite `afterFiles` vẫn "cướp" mất request dù đặt đúng thứ tự | `afterFiles` chạy **trước** khi Next.js xét dynamic route (route có `[...key]`) — route đó không được tính là "file" để né rewrite | Thêm regex loại trừ ngay trong `source`: `/api/:path((?!images\|ping).*)` |
| Avatar mặc định lúc `register()` vẫn ra URL MinIO dù đã đổi `STORAGE_PROVIDER=aws` | Code gọi thẳng `process.env.MINIO_*`, bỏ qua hẳn `StorageService` (nơi đã có logic switch minio/aws đúng) | Inject `StorageService` vào `AuthService`, dùng `buildPublicUrl()` thay vì tự viết logic riêng lần nữa |