# Hướng dẫn triển khai hạ tầng bằng Terraform

Tài liệu này hướng dẫn dùng thư mục `infrastructure/` để tự động hoá việc triển khai hạ tầng cho app: VPC, IAM, EKS, RDS, S3, OIDC/IRSA,
Node Group, EC2 Harbor + Bastion và chứng chỉ ACM.

## 1. Cấu trúc thư mục

```
infrastructure/
├── main.tf            # Root module: ghép các module con
├── variables.tf       # Biến đầu vào của root
├── outputs.tf         # Giá trị cần cho các bước sau (ARN, endpoint, IP...)
├── provider.tf        # AWS provider + default tags
├── versions.tf        # Phiên bản Terraform / provider
├── backend.tf         # S3 backend (partial config)
├── modules/
│   ├── vpc/               # VPC, subnet, IGW, NAT gateway (1 per AZ), route table
│   ├── eks/               # IAM role, cluster, log group, add-on, node group, OIDC, access entry
│   ├── cloudwatch-alarms/ # Metric filter + alarm trên log control plane, SNS email
│   ├── rds/               # RDS PostgreSQL Multi-AZ, subnet group, security group
│   ├── s3/                # Bucket ảnh (block public access)
│   ├── acm/               # Chứng chỉ wildcard (DNS validation)
│   ├── ec2/               # EC2 Ubuntu 24.04 + SG (dùng chung cho Harbor và Bastion)
│   └── iam-irsa/          # IAM policy + role IRSA: backend, frontend, ALB controller, EBS CSI
├── env/
│   ├── dev/   { terraform.tfvars, secrets.tfvars.example, backend.hcl }
│   ├── test/  { terraform.tfvars, secrets.tfvars.example, backend.hcl }
│   └── prod/  { terraform.tfvars, secrets.tfvars.example, backend.hcl }
└── scripts/
    ├── bootstrap-tfstate.sh   # Tạo S3 bucket lưu state (chạy 1 lần)
    └── tf.sh                  # Wrapper: tự init đúng backend + tự thêm -var-file
```

Mỗi module con đều có đủ `main.tf`, `variables.tf`, `outputs.tf`. Các module không tham chiếu chéo nhau:
mọi liên kết (vd: SG của EKS → RDS, OIDC → IRSA) đi qua `outputs`/`variables` và được nối ở `main.tf` gốc.

## 2. Các cấu hình chính

| Hạng mục | Cấu hình |
|---|---|
| NAT gateway | **1 per AZ** (2 NAT + 2 EIP; mỗi private subnet có route table riêng đi qua NAT cùng AZ) |
| RDS | **Multi-AZ DB instance deployment (2 instances)**, master password do Secrets Manager quản lý |
| Harbor / Bastion | Harbor ở **public subnet AZ 1**, Bastion ở **public subnet AZ 2**; key pair có sẵn `harbor-keypair` / `bastion-host-keypair` |
| EKS logging | Bật đủ 5 loại log control plane (`api, audit, authenticator, controllerManager, scheduler`) → CloudWatch `/aws/eks/<cluster>/cluster` |
| CloudWatch alarm | 6 alarm dựa trên **log** control plane → SNS → email |

### Vì sao alarm chỉ bám vào log control plane?
Prometheus đã giám sát workload/node, còn `kubeScheduler`/`kubeControllerManager`/`kubeEtcd` phải tắt trong
values kube-prometheus-stack vì EKS chạy control plane ngoài account của mình: CloudWatch Logs là nơi duy nhất thấy
được control plane. Các alarm: `api_server_5xx`, `api_server_throttled` (429), `api_unauthorized` (401/403),
`authenticator_denied`, `control_plane_errors` (dòng klog `E....`), `leader_election_lost`.
Ngưỡng chỉnh qua biến `alarm_thresholds` (số dòng log khớp trong 5 phút).
**Email nhận cảnh báo phải bấm "Confirm subscription" trong thư AWS gửi.**

### Khác biệt nhỏ so với tài liệu thủ công
- `techshop-secrets-manager-policy` trỏ **đúng ARN secret** của RDS thay vì wildcard `rds!db-*`.
- Policy ALB Controller đặt tên `<name_prefix>-alb-controller-policy` (IAM là global trong account nên cần tiền tố
  để nhiều môi trường không đụng tên).
- `db_engine_version` mặc định `"18"` (RDS tự chọn minor mới nhất); muốn ghim thì đặt `"18.3"`.
- Harbor có Elastic IP, EC2 bật IMDSv2 + mã hoá EBS.
- Subnet chia tự động từ `vpc_cidr` (`/16` → 4 khối `/20`); với `10.0.0.0/16` ra đúng 10.0.0.0/20, 10.0.16.0/20,
  10.0.128.0/20, 10.0.144.0/20.
- `modules/iam-irsa/policies/aws-load-balancer-controller-iam-policy.json` lấy từ nhánh `main` của
  kubernetes-sigs; nên tải lại khi nâng version controller.

## 3. Các môi trường

| | dev | test | prod |
|---|---|---|---|
| `name_prefix` | `techshop-dev` | `techshop-test` | `techshop` (khớp tài liệu thủ công) |
| `vpc_cidr` | 10.10.0.0/16 | 10.20.0.0/16 | 10.0.0.0/16 |
| Bảo vệ DB khi destroy | tắt | tắt | bật + snapshot cuối |
| Retention log EKS | 14 ngày | 30 ngày | 90 ngày |

Cả 3 môi trường đều giữ nguyên NAT 1 per AZ và RDS Multi-AZ.

## 4. Yêu cầu trước khi chạy

- Terraform >= 1.10 (cần cho state locking bằng S3), AWS CLI đã `aws configure` với quyền quản trị.
- 2 key pair **đã tồn tại** trong đúng region: `harbor-keypair`, `bastion-host-keypair`.
- Tên bucket S3 (`s3_bucket_name`) duy nhất toàn cầu, đổi trong `terraform.tfvars` nếu bị trùng.
- Script `scripts/*.sh` là bash: trên Windows chạy bằng **Git Bash** hoặc **WSL**. Nếu chỉ dùng PowerShell,
  làm theo mục [5.3 Chạy tay](#53-chạy-tay-không-qua-script).

## 5. Chạy ở local

Các lệnh dưới đây chạy từ thư mục gốc của project, bắt đầu bằng `cd infrastructure`.

### 5.1 Chuẩn bị (làm 1 lần)

```bash
cd infrastructure

# Tạo S3 bucket lưu state (dùng chung cho cả 3 môi trường, mỗi môi trường có key riêng)
# Phải chạy trên WSL / Git Bash / Linux, không chạy PowerShell, nếu không sử dụng các tool này thì phải tạo thủ công trên AWS Console.
bash scripts/bootstrap-tfstate.sh

# Tạo file giá trị cá nhân của môi trường muốn chạy (file này đã được .gitignore), rồi điền email + IP thật
cp env/prod/secrets.tfvars.example env/prod/secrets.tfvars
```

### 5.2 Chạy bằng `scripts/tf.sh`

Cú pháp: `bash scripts/tf.sh <dev|test|prod> <lệnh terraform> [tham số...]`

| Lệnh | Script làm gì |
|---|---|
| `fmt` | `terraform fmt -recursive`: chỉ format code, không cần AWS |
| `validate` | `terraform init -backend=false` + `terraform validate`: không đụng S3/state, không cần AWS credentials |
| `plan` / `apply` / `destroy` / `refresh` / `import` / `console` | `terraform init -reconfigure` với `env/<env>/backend.hcl` và bucket `techshop-tfstate-<account-id>`, rồi gắn `-var-file` cho `terraform.tfvars` (và `secrets.tfvars` nếu file tồn tại) |
| lệnh khác (`output`, `state`, `show`, `force-unlock`...) | `terraform init -reconfigure` như trên, rồi chạy lệnh đúng như ta gõ (không gắn `-var-file`) |

Tham số `<env>` luôn bắt buộc, kể cả với `fmt` (lệnh này quét cả thư mục và không phụ thuộc môi trường).

**Format và kiểm tra code** (nên chạy trước mỗi lần commit):

```bash
bash scripts/tf.sh dev fmt               # ghi đè format chuẩn vào các file .tf
bash scripts/tf.sh dev fmt -check        # chỉ kiểm tra, có file sai format thì báo lỗi
bash scripts/tf.sh dev validate          # kiểm tra cú pháp, biến, tham chiếu giữa các module
```

**Lập kế hoạch và triển khai:**

```bash
bash scripts/tf.sh prod plan
bash scripts/tf.sh prod apply            # ~25-40 phút (EKS, RDS Multi-AZ)
```

**Xem output** (chỉ có giá trị sau khi `apply` thành công; cần AWS credentials vì phải đọc state trên S3):

```bash
bash scripts/tf.sh prod output                          # liệt kê toàn bộ output
bash scripts/tf.sh prod output vpc_id                   # 1 output, có dấu nháy với giá trị chuỗi
bash scripts/tf.sh prod output -raw rds_endpoint        # 1 output chuỗi, in thô, không dấu nháy
bash scripts/tf.sh prod output -json acm_validation_records   # output dạng list/object
```

`-raw` chỉ dùng được với output kiểu chuỗi (hoặc số). Các output dạng list/object như `public_subnet_ids`,
`private_subnet_ids`, `nat_gateway_public_ips`, `acm_validation_records` phải dùng `-json`.

### 5.3 Chạy tay (không qua script)

Đứng trong thư mục `infrastructure/`. Các lệnh `fmt` và `validate` giống nhau ở mọi shell:

```bash
terraform fmt -recursive                 # ghi đè format chuẩn
terraform fmt -recursive -check          # chỉ kiểm tra

terraform init -backend=false            # tải provider + module, KHÔNG kết nối S3
terraform validate
```

Để `plan`/`apply`/`output` thì phải init với S3 backend. `-reconfigure` là bắt buộc khi ta vừa init
bằng `-backend=false` hoặc khi đổi sang môi trường khác (mỗi môi trường có một `key` state riêng).

**Bash / Git Bash / WSL:**

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
terraform init -reconfigure \
  -backend-config=env/prod/backend.hcl \
  -backend-config="bucket=techshop-tfstate-${ACCOUNT_ID}"

terraform plan  -var-file=env/prod/terraform.tfvars -var-file=env/prod/secrets.tfvars
terraform apply -var-file=env/prod/terraform.tfvars -var-file=env/prod/secrets.tfvars
```

**PowerShell:**

```powershell
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
terraform init -reconfigure `
  -backend-config="env/prod/backend.hcl" `
  -backend-config="bucket=techshop-tfstate-$ACCOUNT_ID"

terraform plan  -var-file="env/prod/terraform.tfvars" -var-file="env/prod/secrets.tfvars"
terraform apply -var-file="env/prod/terraform.tfvars" -var-file="env/prod/secrets.tfvars"
```

**Xem output** (giống nhau ở mọi shell, không cần `-var-file`, nhưng phải đã init đúng backend của môi trường đó):

```bash
terraform output                              # liệt kê toàn bộ output
terraform output vpc_id                       # 1 output
terraform output -raw rds_endpoint            # 1 output chuỗi, in thô
terraform output -json acm_validation_records # output dạng list/object
```

## 6. Phần còn lại vẫn thực hiện thủ công theo hướng dẫn trong `docs/eks-manual-deployment-guide.md`

1. **dynv6:** tạo zone; tạo CNAME xác thực ACM từ output `acm_validation_records` (Value có dấu `.` ở cuối).
2. **Phần 10:** cấu hình lại `kubeconfig`, rồi `kubectl create namespace electronics-shop`.
3. **Phần 16:** tạo A record `harbor` → output `harbor_public_ip`, rồi chạy `scripts/setup-harbor-ec2.sh`.
4. **Phần 17, 18, 22:** Harbor project/robot, GitHub secrets, webhook.
5. **Phần 19:** `scripts/install-eks-tools.sh`: lấy các giá trị script hỏi từ output:

   | Script hỏi | Output |
   |---|---|
   | VPC ID | `vpc_id` |
   | ARN role ALB Controller | `alb_controller_role_arn` |
   | ARN role EBS CSI Driver | `ebs_csi_role_arn` |
   | ARN chứng chỉ ACM | `acm_certificate_arn` |

   Điền `argo/argocd-application-eks.yaml`: `rds_endpoint` → `rds.host`, `rds_master_secret_arn` →
   `secretsManager.dbSecretArn`, `s3_bucket` → `s3.bucket`, `backend_irsa_role_arn` / `frontend_irsa_role_arn` →
   `serviceAccount.backend/frontend.roleArn`, `acm_certificate_arn` → `ingress.alb.certificateArn`.
6. **Phần 20, 21, 23–25:** seed DB qua bastion, DNS 6 domain, sync Argo CD.

## 7. Xoá hạ tầng
 
### 7.1 Gỡ tài nguyên do Kubernetes tạo ra (bắt buộc làm trước)
 
Nếu để sót ALB/NLB/EBS volume, chúng vẫn giữ ENI/subnet và `destroy` sẽ bị treo ở bước xoá VPC:
 
```bash
kubectl delete application -n argocd --all
helm uninstall traefik -n traefik
helm uninstall kube-prometheus-stack -n monitoring     # Prometheus/Grafana/Alertmanager

# đợi tới khi hết pod trong 2 namespace này rồi mới xoá PVC
kubectl get pods -n traefik
kubectl get pods -n monitoring

kubectl delete ingress -A --all
kubectl delete pvc -A --all
# đợi ALB/NLB biến mất trong EC2 → Load Balancers rồi mới sang bước tiếp theo
```
 
### 7.2 Điều kiện riêng của từng môi trường
 
- **Prod bật `db_deletion_protection = true`:** sửa thành `false` trong `env/prod/terraform.tfvars`, chạy `apply`
  cho thay đổi này, rồi mới `destroy`. Nếu không, xoá RDS sẽ bị từ chối.
- **Bucket S3 còn ảnh:** cần `s3_force_destroy = true` (dev/test đã bật sẵn, prod thì không), cũng phải `apply` trước.
- **Prod (`db_skip_final_snapshot = false`):** khi destroy, RDS chụp snapshot cuối tên cố định
  `<name_prefix>-postgres-final`. Nếu snapshot cùng tên đã tồn tại từ lần destroy trước thì lần này sẽ lỗi,
  hãy xoá hoặc đổi tên snapshot cũ trước.
### 7.3 Destroy bằng `scripts/tf.sh`
 
```bash
bash scripts/tf.sh prod plan -destroy    # xem trước sẽ xoá những gì (không xoá thật)
bash scripts/tf.sh prod destroy          # Terraform hỏi xác nhận, gõ yes để xoá
```
 
### 7.4 Destroy bằng tay
 
Phải init đúng backend của môi trường cần xoá trước (giống mục 5.3), vì `destroy` đọc và ghi state của
môi trường mà thư mục `.terraform/` đang trỏ tới. Ngoài ra phải truyền `-var-file`, vì code vẫn cần đủ biến để
Terraform đọc được cấu hình.
 
**Bash / Git Bash / WSL:**
 
```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
terraform init -reconfigure \
  -backend-config=env/prod/backend.hcl \
  -backend-config="bucket=techshop-tfstate-${ACCOUNT_ID}"
 
terraform plan -destroy -var-file=env/prod/terraform.tfvars -var-file=env/prod/secrets.tfvars   # xem trước
terraform destroy       -var-file=env/prod/terraform.tfvars -var-file=env/prod/secrets.tfvars   # gõ yes để xoá
```
 
**PowerShell:**
 
```powershell
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
terraform init -reconfigure `
  -backend-config="env/prod/backend.hcl" `
  -backend-config="bucket=techshop-tfstate-$ACCOUNT_ID"
 
terraform plan -destroy -var-file="env/prod/terraform.tfvars" -var-file="env/prod/secrets.tfvars"   # xem trước
terraform destroy       -var-file="env/prod/terraform.tfvars" -var-file="env/prod/secrets.tfvars"   # gõ yes để xoá
```
 
Ví dụ trên dùng môi trường `prod`; đổi `prod` thành `test` hoặc `dev` cho đúng môi trường muốn xoá, và kiểm tra
kỹ tên môi trường trước khi gõ `yes`.
 
Bucket lưu state (`techshop-tfstate-<account-id>`) do `bootstrap-tfstate.sh` tạo và **không** thuộc state của
Terraform nên `destroy` sẽ không xoá nó. Chỉ xoá bucket này khi đã xoá xong cả 3 môi trường và không còn cần state.

Xóa bucket S3 lưu state (chỉ làm khi chắc chắn không còn môi trường nào cần Terraform nữa):

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws s3 rb s3://techshop-tfstate-${ACCOUNT_ID} --force
```

## 8. Lỗi thường gặp

| Lỗi | Nguyên nhân / cách xử lý |
|---|---|
| `Failed to query available provider packages ... connection was forcibly closed` khi `terraform init` | Lỗi mạng tới `registry.terraform.io` (hay gặp khi qua IPv6/VPN/antivirus). Chạy lại vài lần; nếu vẫn lỗi thì đổi mạng, đổi DNS (`1.1.1.1`), hoặc tắt IPv6 tạm thời |
| `Error acquiring the state lock` | Đang có người/lệnh khác chạy trên cùng môi trường. Đợi họ xong. Nếu chắc chắn không còn ai chạy (lệnh trước bị ngắt đột ngột) thì `bash scripts/tf.sh <env> force-unlock <LOCK_ID>` (ID nằm trong thông báo lỗi) |
| `No value for required variable` hoặc Terraform hỏi nhập `admin_ssh_cidrs`, `alarm_email_addresses` | Chưa tạo `env/<env>/secrets.tfvars` (mục 5.1), hoặc khi chạy tay quên `-var-file` cho file này |
| `Backend initialization required` hoặc `Backend configuration changed` | Vừa đổi môi trường hoặc vừa `init -backend=false`. Chạy lại `terraform init -reconfigure ...` (mục 5.3) hoặc dùng `tf.sh` |
| `The state file either has no outputs defined` khi `terraform output` | Môi trường đó chưa `apply` lần nào, hoặc đang init nhầm sang môi trường khác |

## 9. Chi phí

Mỗi môi trường chạy 2 NAT gateway + RDS `db.m5.large` Multi-AZ + 2 node `t3.medium` + EKS control plane liên tục.
Dev/test nhớ `destroy` khi không dùng.