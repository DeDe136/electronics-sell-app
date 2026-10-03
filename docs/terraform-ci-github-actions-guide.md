# Hướng dẫn CI/CD hạ tầng Terraform bằng GitHub Actions

Tài liệu này mô tả pipeline `.github/workflows/terraform.yml`: tự động `fmt` → `validate` → **Checkov** → `plan` →
`apply` / `destroy` cho thư mục `infrastructure/`.

## 1. Luồng chạy

```
 ┌─> prepare ───────────────────────────> checkov ──┐
─┤                                                  ├─> plan ─┬─> apply (chờ phê duyệt)
 └─> static-checks (terraform fmt + validate) ──────┘         └─> destroy (chờ phê duyệt)

```

| Sự kiện | Chạy gì |
|---|---|
| Pull request vào `main`/`thanhde` **có sửa `infrastructure/**` hoặc `terraform.yml`** | fmt, validate, Checkov, **plan**. Không apply |
| Push vào `thanhde` (cùng điều kiện sửa file như trên) | Như trên (kiểm thử mỗi lần push, không cần tạo PR). Không apply |
| Push vào `main` (cùng điều kiện sửa file như trên) | Như trên, rồi **apply** vào môi trường `TF_AUTO_ENV` (mặc định `prod`) nếu plan có thay đổi |
| **Lịch hằng ngày** 20:00 UTC (03:00 sáng giờ Việt Nam), luôn chạy trên `main` | Như push vào `main`: fmt, validate, Checkov, plan, rồi apply nếu có **drift** (xem bên dưới) |
| Bấm tay (`Actions` → `Terraform - Infrastructure` → `Run workflow`) | Chọn `dev`/`test`/`prod`, rồi tick **tối đa một** trong hai: `apply` hoặc `destroy`. Không tick gì = chỉ plan. Cả `apply` lẫn `destroy` chỉ được chạy từ nhánh `main` |

**Vì sao có `paths:` và `schedule`:** push/PR chỉ chạy khi có sửa `infrastructure/**` hoặc chính file workflow, nên commit chỉ
sửa code app không tốn runner. Việc phát hiện **drift** (hạ tầng thật trên AWS lệch so với code, vd: có người lỡ xoá tay một
tài nguyên trong khi code không đổi) giao cho lịch hằng ngày: `plan` so state với AWS thật, nếu lệch thì job `apply` được kích
hoạt để đưa hạ tầng về đúng cấu hình khai báo (prod chờ Required reviewers duyệt; không lệch thì apply tự bỏ qua). Đổi tần
suất bằng dòng `cron` trong `terraform.yml` (vd hằng tuần: `"0 20 * * 0"`).

Lưu ý về lịch: GitHub có thể trễ vài phút đến vài chục phút so với giờ hẹn; repo **public** không có hoạt động trong 60 ngày
sẽ bị GitHub tự tắt schedule.

Commit do `deploy.yml` tạo ra (cập nhật image tag trong `helm/**`) **không** kích hoạt pipeline này: xem mục 9.

Các điểm an toàn đã tích hợp sẵn:

- **Checkov chạy trước khi chạm vào AWS.** Có lỗi mức hard-fail thì `plan`/`apply`/`destroy` không chạy.
- **Apply/destroy đúng file `tfplan` đã review**, không plan lại. Nếu state thay đổi giữa chừng, Terraform từ chối plan cũ
  (`Saved plan is stale`). Danh sách tài nguyên sẽ bị xoá/thay thế hiện ở **Job Summary** của job `plan`.
- **Khoá theo môi trường:** `concurrency` cấp workflow, nhóm `terraform-<môi trường>`, `cancel-in-progress: false`. Hai lần
  chạy cùng môi trường không chạy song song và không bao giờ bị huỷ ngang giữa lúc apply/destroy. Lưu ý: một lần chạy đang
  chờ phê duyệt Environment vẫn giữ khoá, các lần chạy sau của cùng môi trường (kể cả lịch hằng ngày hay một lần destroy bấm
  tay) sẽ xếp hàng cho đến khi duyệt hoặc từ chối. Nên duyệt/từ chối yêu cầu apply do drift sớm, đừng để treo.
- **Destroy chỉ qua `workflow_dispatch`**, không bao giờ qua push/PR; không được tick cùng lúc `apply` và `destroy`
  (pipeline báo lỗi ngay ở job `prepare`).

## 2. Chuẩn bị phía AWS: OIDC thay cho access key

Pipeline dùng GitHub OIDC để assume IAM role, **không lưu access key dài hạn** trong GitHub Secrets. Chạy 1 lần bằng quyền admin:

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
GH_REPO="<owner>/<repo>"     # vd: thanhde/electronics-sell-app-thanhde

# 1) OIDC provider (nếu báo EntityAlreadyExists nghĩa là account đã có, bỏ qua)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com

# 2) Trust policy: chỉ repo này mới assume được role
cat > trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": [
          "repo:${GH_REPO}:pull_request",
          "repo:${GH_REPO}:ref:refs/heads/main",
          "repo:${GH_REPO}:ref:refs/heads/thanhde",
          "repo:${GH_REPO}:environment:*"
        ]
      }
    }
  }]
}
EOF

# 3) Role (max-session-duration 2 giờ vì apply/destroy EKS + RDS Multi-AZ mất ~25-40 phút)
aws iam create-role \
  --role-name techshop-github-actions-terraform \
  --assume-role-policy-document file://trust-policy.json \
  --max-session-duration 7200

aws iam attach-role-policy \
  --role-name techshop-github-actions-terraform \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

echo "AWS_ROLE_ARN = arn:aws:iam::${ACCOUNT_ID}:role/techshop-github-actions-terraform"
```

Bốn giá trị `sub` ứng với: job plan trong PR, job plan sau khi push `main`, job plan sau khi push `thanhde` (hoặc bấm tay từ
nhánh đó), và các job apply/destroy (có khai báo `environment:`).

> **Về `AdministratorAccess`:** Terraform ở đây tạo VPC, EKS, RDS, IAM role/policy, S3, ACM, EC2, CloudWatch, SNS nên
> quyền hẹp phải liệt kê rất dài. Dùng Admin cho gọn, bù lại bằng trust policy chỉ cho đúng repo này. Khi pipeline đã
> ổn định, nên thu hẹp dần (vd: loại bỏ quyền quản lý billing/organization).

## 3. Chuẩn bị phía GitHub

**Settings → Secrets and variables → Actions → tab Secrets**

| Secret | Giá trị | Ghi chú |
|---|---|---|
| `AWS_ROLE_ARN` | ARN role vừa tạo ở mục 2 | |
| `ALARM_EMAIL_ADDRESSES` | `["you@example.com"]` | Dạng list JSON/HCL, có cả dấu `[ ]` và nháy kép |
| `ADMIN_SSH_CIDRS` | `["1.2.3.4/32"]` | IP của bạn (https://checkip.amazonaws.com). Không được là `0.0.0.0/0` |

Hai secret sau thay cho file `env/<env>/secrets.tfvars` ở local (`scripts/tf.sh` đã hỗ trợ sẵn qua `TF_VAR_*`).
Email nhận cảnh báo vẫn phải bấm *Confirm subscription* trong thư AWS gửi sau lần apply đầu tiên.

**Tab Variables**

| Variable | Mặc định | Ý nghĩa |
|---|---|---|
| `TF_AUTO_ENV` | `prod` | Môi trường mà PR, push (`main`, `thanhde`) và lịch hằng ngày plan tới; push `main` và lịch còn apply tới đây |
| `TF_VERSION` | `~> 1.10` (1.x mới nhất) | **Nên ghim đúng bản đang dùng ở local** (`terraform version`), ví dụ `1.15.4`. State do bản Terraform mới hơn ghi sẽ không đọc được bằng bản cũ hơn ở máy bạn |

**Settings → Environments:** tạo 3 environment `dev`, `test`, `prod`.
Với `prod`: bật **Required reviewers** (chọn chính bạn) và **Deployment branches → Selected branches → `main`**.
Required reviewers của `prod` áp dụng cho **cả apply lẫn destroy**: không bật thì push vào `main` sẽ apply thẳng, và
destroy prod chạy ngay sau plan mà không chờ ai duyệt. `dev`/`test` không bắt buộc reviewers, nhưng nếu không bật thì
destroy dev/test cũng chạy ngay sau plan.

## 4. Triển khai hạ tầng tự động bằng GitHub Actions (lần đầu, môi trường prod)

Mục này hướng dẫn dựng hạ tầng **từ state trống** hoàn toàn bằng pipeline. Môi trường mặc định là `prod` (Variable `TF_AUTO_ENV` mặc định), key state sẽ là
`electronics-shop/prod/terraform.tfstate`.

### 4.1 Điều kiện cần có

- Đã làm xong mục 2 (role OIDC) và mục 3 (3 secret, Environment `prod` có Required reviewers + chỉ nhánh `main`).
- Đã ghim Variable `TF_VERSION` đúng bản `terraform version` ở máy bạn (mục 3).
- 2 key pair `harbor-keypair` và `bastion-host-keypair` **đã tồn tại** trong region `ap-southeast-1`. Thiếu thì plan báo
  `InvalidKeyPair.NotFound`.
- `s3_bucket_name` trong `infrastructure/env/prod/terraform.tfvars` chưa bị ai trên thế giới dùng (tên S3 là duy nhất toàn
  cầu). Trùng tên thì plan vẫn qua, nhưng apply báo `BucketAlreadyExists`, lúc đó đổi tên rồi chạy lại.

### 4.2 Bước 1: tạo bucket S3 lưu state (làm 1 lần, chạy ở máy local)

Bucket lưu state phải có trước khi pipeline chạy, vì job `plan` cần `terraform init` vào backend S3. Chạy bằng Git Bash,
WSL hoặc Linux (không dùng PowerShell), với AWS CLI đã `aws configure` đúng **account** mà role OIDC ở mục 2 thuộc về:

```bash
cd infrastructure
bash scripts/bootstrap-tfstate.sh
# Xong. State bucket: techshop-tfstate-<account-id>
```

Script tạo bucket `techshop-tfstate-<account-id>` (bật versioning, mã hoá, chặn public access). Pipeline suy ra đúng tên này
từ account ID của role đang assume nên **không cần khai báo thêm** ở đâu. Bucket này nằm ngoài state của Terraform nên
`destroy` không xoá nó. File state của prod sẽ tự được tạo ở lần apply đầu tiên.

### 4.3 Bước 2: push một thay đổi nhỏ để kích hoạt pipeline

Pipeline chỉ chạy khi commit sửa `infrastructure/**` hoặc `.github/workflows/terraform.yml` (cấu hình `paths:`), nên cần một
commit nhỏ, ví dụ thêm hoặc chỉnh một dòng **comment** trong `infrastructure/main.tf` (hoặc trong `terraform.yml`), rồi push
lên nhánh `<feature>`:

```bash
git checkout -b <feature>
# sửa/thêm 1 dòng comment trong infrastructure/ hoặc .github/workflows/terraform.yml
git add -A
git commit -m "chore(infra): trigger the Terraform pipeline for the first time"
git push origin <feature>
```

Vào **Actions → Terraform - Infrastructure**, run vừa tạo chạy các job 1–4 (`prepare`, `static-checks`, `checkov`, `plan`)
trên `prod` và **không apply**. Mở **Job Summary** của job *Terraform Plan* để xem kết quả. Vì state đang trống nên kỳ vọng là
`Plan: N to add, 0 to change, 0 to destroy` (N lớn: tạo toàn bộ VPC, EKS, RDS, S3, IAM...). Nếu thấy dòng `to destroy` hoặc
`replace`, hãy dừng lại và kiểm tra trước khi đi tiếp.

| Lỗi gặp ở bước này | Nguyên nhân / cách xử lý |
|---|---|
| `init` báo bucket không tồn tại / `AccessDenied` | Chưa làm bước 4.2, hoặc bucket nằm ở account/region khác với role OIDC |
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | Trust policy ở mục 2 chưa đúng, xem mục 7 |
| Job `checkov` fail | Có lỗi hard-fail mới, xem mục 5 |
| `InvalidKeyPair.NotFound` | Chưa tạo 2 key pair ở mục 4.1 |

### 4.4 Bước 3: tạo PR, merge vào `main` và duyệt apply

1. Tạo Pull Request từ `<feature>` vào `main`. PR cũng chạy các job 1–4 để kiểm tra lại (không apply).
2. Merge PR. Việc merge tạo một push vào `main` nên pipeline chạy đủ jobs 1–5.
3. Sau khi `plan` xong, job **Terraform Apply** dừng ở trạng thái *Waiting* vì Environment `prod` có Required reviewers.
   Mở run đó, bấm **Review deployments**, tick `prod`, rồi **Approve and deploy**.
4. Job apply chạy đúng file `tfplan` đã review, mất khoảng 25–40 phút (EKS, RDS Multi-AZ). Khi xong, Job Summary hiển thị
   toàn bộ `terraform output`.

Nếu bạn đã bật *Prevent self-review* cho Environment thì người duyệt phải là người khác, không phải người merge. Nếu chưa bật
Required reviewers thì apply sẽ chạy ngay sau plan, không chờ ai.

### 4.5 Cách khác: chạy tay bằng `workflow_dispatch` (không cần commit/PR)

Dùng khi muốn apply mà không phải sửa code rồi merge PR. Điều kiện: file `terraform.yml` **đã nằm trên nhánh `main`**
(nút *Run workflow* chỉ xuất hiện khi file có trên nhánh mặc định, nên lần đầu tiên chưa có file trên `main` thì phải đi theo
cách 4.3 + 4.4 trước).

1. **Actions → Terraform - Infrastructure → Run workflow.**
2. **Branch: `main`**, chọn môi trường `prod`.
3. Tick **`apply`** (không tick `destroy`), bấm **Run workflow**. Không tick gì thì pipeline chỉ plan.
4. Job apply cũng dừng chờ duyệt ở **Review deployments** như mục 4.4.

### 4.6 Sau khi apply xong

- **Kiểm tra tính nhất quán:** chạy lại một lần *Run workflow* (`prod`, không tick gì). Plan phải là `No changes`.
- **Làm tiếp các việc thủ công** theo mục 6 của `docs/terraform-infrastructure-guide.md`: tạo CNAME xác thực ACM trên dynv6
  từ output `acm_validation_records` (apply không chờ xác thực nên chứng chỉ ở trạng thái *Pending validation* cho tới khi bạn
  tạo CNAME), tạo A record cho Harbor, bấm *Confirm subscription* trong email cảnh báo CloudWatch...
- **Từ giờ về sau:** sửa code hạ tầng, push lên `<feature>` để xem plan, tạo PR, merge vào `main`, duyệt ở *Review deployments*.
  Lịch hằng ngày tự quét drift và đề nghị apply nếu hạ tầng thật bị lệch.

### 4.7 Muốn thử trên dev trước (tuỳ chọn)

Chạy tay (4.5) và chọn môi trường `dev` là đủ. Nếu muốn push/PR cũng plan vào `dev`, đặt Variable `TF_AUTO_ENV = dev`
rồi xoá Variable đó khi chuyển sang `prod`. Nhớ destroy dev khi không dùng (mục 6).

## 5. Checkov

Cấu hình: `infrastructure/.checkov.yaml`. Chạy local từ thư mục gốc repo, giống hệt CI:

```bash
pip install checkov
checkov -d infrastructure --config-file infrastructure/.checkov.yaml \
        --var-file infrastructure/env/prod/terraform.tfvars
```

Mỗi check Checkov thuộc 1 trong 3 nhóm:

| Nhóm | Hành vi | Trong cấu hình hiện tại |
|---|---|---|
| Không khai báo trong file | **Hard fail**: chặn pipeline | Mọi check còn lại (SG mở `0.0.0.0/0`, RDS public, S3 không mã hoá, IAM `*:*`...) |
| `soft-fail-on` | Hiện trong báo cáo/SARIF, **không chặn** | 11 check "nợ kỹ thuật" bên dưới (+ `CKV_AWS_293` chỉ soft-fail ở dev/test) |
| `skip-check` | Chấp nhận có chủ đích, lý do ghi ngay trong file | 17 check (EKS endpoint public, Harbor/Bastion public IP, ACM wildcard, CMK...) |

Riêng `prod`, CI ép `CKV_AWS_293` (RDS deletion protection) thành hard fail; `dev`/`test` cố ý tắt nên chỉ soft-fail.

### Nợ kỹ thuật cần xử lý dần (soft-fail)

Thứ tự gợi ý: các mục đầu rẻ và ít rủi ro nhất. Tất cả đều là thay đổi tại chỗ (không buộc tạo lại tài nguyên) nhưng hãy
đọc kỹ `plan` trước khi apply ở prod.

| Check | Vấn đề | Hướng sửa |
|---|---|---|
| `CKV2_AWS_12` | Default Security Group của VPC còn rule mặc định | Thêm `aws_default_security_group` không có rule nào (kiểm tra không có tài nguyên nào đang dùng default SG) |
| `CKV_AWS_21` | Bucket ảnh chưa bật versioning | Thêm `aws_s3_bucket_versioning` |
| `CKV_AWS_23` | Egress rule của SG (module `ec2`) thiếu description | Thêm `description` cho `aws_vpc_security_group_egress_rule.all` |
| `CKV2_AWS_60` | RDS không copy tag sang snapshot | `copy_tags_to_snapshot = true` |
| `CKV_AWS_129` | RDS không xuất log lên CloudWatch | `enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]` |
| `CKV2_AWS_30` | RDS chưa bật query logging | Parameter group riêng với `log_min_duration_statement`; đổi parameter group có thể cần reboot (Multi-AZ sẽ failover) |
| `CKV_AWS_118` | RDS chưa bật Enhanced Monitoring | `monitoring_interval = 60` + IAM role cho monitoring |
| `CKV2_AWS_41` | Harbor/Bastion chưa có IAM role | Gắn instance profile (vd: SSM) để giảm phụ thuộc SSH |
| `CKV2_AWS_11` | VPC chưa bật Flow Logs | `aws_flow_log` → CloudWatch Logs/S3 (phát sinh chi phí log) |
| `CKV_AWS_58` | EKS chưa mã hoá Kubernetes Secrets bằng KMS | `encryption_config` + KMS key. **Không thể tắt lại** sau khi bật |
| `CKV_AWS_394` | `aws_availability_zones` chưa ghim zone | Lọc theo `zone_ids`/tên cụ thể thay vì `slice(names, 0, 2)` |

Sửa xong 1 mục: xoá ID đó khỏi `soft-fail-on` để từ nay nó thành hard fail, tránh tái phát.

## 6. Destroy hạ tầng bằng workflow_dispatch

Destroy là thao tác không thể hoàn tác, nên pipeline **chỉ** cho chạy bằng tay (`Run workflow`), từ nhánh `main`, và phải
tick `destroy` (không tick cùng `apply`). Môi trường `prod` còn phải được **Required reviewers** phê duyệt.
**Bắt buộc làm đủ các bước tiền đề dưới đây TRƯỚC khi bấm Run workflow**, nếu không destroy sẽ treo hoặc báo lỗi giữa chừng
(đã xoá dở một phần tài nguyên).

### 6.1 Mọi môi trường: gỡ tài nguyên do Kubernetes tạo ra

ALB/NLB/EBS do Kubernetes tạo ra nằm ngoài state của Terraform nhưng vẫn giữ ENI/subnet, nên nếu để sót thì `destroy` sẽ
treo ở bước xoá VPC. Kết nối `kubectl` tới đúng cluster của môi trường cần xoá rồi chạy:

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

> `kubectl` chỉ nhận một cờ `-n`; viết `kubectl get pods -n traefik -n monitoring` thì cờ cuối thắng và chỉ hiện namespace
> `monitoring`. Vì vậy phải kiểm tra từng namespace riêng như trên.

### 6.2 Riêng prod: làm thêm trên AWS Console

Với dev/test đã bật `s3_force_destroy = true`, `db_deletion_protection = false`, `db_skip_final_snapshot = true` trong tfvars
nên **không cần thực hiện** bước này. Prod thì cả ba đều chặn việc xoá, phải làm tay:

1. **Empty bucket ảnh:** S3 → bucket `s3_bucket_name` trong `env/prod/terraform.tfvars` (hiện là `techshop-images-bk`) →
   **Empty**. Bucket còn object thì xoá sẽ lỗi `BucketNotEmpty`.
2. **Tắt Deletion Protection của RDS:** RDS → Databases → `<name_prefix>-postgres` (prod: `techshop-postgres`) →
   **Modify** → bỏ tick *Enable deletion protection* → Continue → *Apply immediately*.
3. **Xoá snapshot cuối cũ (nếu có):** RDS → Snapshots → Manual → xoá `<name_prefix>-postgres-final` (prod:
   `techshop-postgres-final`). Prod có `db_skip_final_snapshot = false` nên lúc destroy RDS sẽ chụp snapshot cuối tên cố
   định này; nếu tên đã tồn tại từ lần trước thì destroy lỗi.

### 6.3 Chạy destroy

1. `Actions` → `Terraform - Infrastructure` → `Run workflow`, **Branch: `main`**, chọn môi trường, tick **`destroy`**, bỏ tick `apply`.
2. Job `plan` chạy `plan -destroy`. Mở **Job Summary** của job này, kiểm tra kỹ danh sách tài nguyên sẽ bị xoá và đúng môi
   trường (dòng đầu tiên ghi rõ `plan -destroy — <môi trường>`).
3. Với `prod` (và `dev`/`test` nếu đã bật reviewers): job `destroy` dừng chờ, người được chỉ định bấm **Review deployments →
   Approve**. Từ chối thì không có gì bị xoá.
4. Job `destroy` thực thi đúng plan đã duyệt (~20–40 phút).

Sau khi destroy:
- Bucket state `techshop-tfstate-<account-id>` do `bootstrap-tfstate.sh` tạo **không** bị xoá (không thuộc state của Terraform).
- Prod để lại snapshot `<name_prefix>-postgres-final` (không còn được Terraform quản lý); nhớ xoá nó trước lần destroy prod kế tiếp.
- Nếu đã tắt Deletion Protection ở bước 6.2 nhưng sau đó **từ chối/huỷ** destroy, lần push `main` kế tiếp `plan` sẽ thấy lệch
  và `apply` bật lại Deletion Protection theo code.

## 7. Lỗi thường gặp

| Lỗi | Nguyên nhân / cách xử lý |
|---|---|
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | Trust policy không khớp `sub`. Kiểm tra `GH_REPO` đúng `owner/repo` (phân biệt hoa thường), job apply/destroy cần `environment:*`. Đổi `role-duration-seconds` lớn hơn `--max-session-duration` của role cũng báo lỗi tương tự |
| `Chỉ được tick MỘT trong hai` | Run workflow đang tick cả `apply` lẫn `destroy`. Chạy lại, chỉ tick một |
| `Destroy chỉ được phép chạy từ nhánh main` | Chọn sai nhánh ở ô *Branch* khi Run workflow |
| `Thiếu secret ...` ở bước *Verify required secrets* | Chưa khai báo `AWS_ROLE_ARN`, `ALARM_EMAIL_ADDRESSES` hoặc `ADMIN_SSH_CIDRS` (mục 3) |
| `Invalid value for input variable` | Secret list sai định dạng; phải là `["a@b.com"]`, không phải `a@b.com` |
| `terraform fmt -check` fail | Chạy `bash scripts/tf.sh dev fmt` ở local rồi commit lại |
| `Error acquiring the state lock` | Có lệnh khác (ngoài pipeline, vd chạy tay ở local) đang chạy trên cùng môi trường. Pipeline chờ tối đa 10 phút |
| `Saved plan is stale` ở job apply/destroy | State đã đổi kể từ lúc plan (vd: có người apply tay xen giữa). Chạy lại pipeline để plan mới |
| Destroy treo ở `aws_vpc`/`aws_subnet` | Còn ALB/NLB/EBS/ENI do Kubernetes tạo (bỏ sót mục 6.1). Xoá chúng trên Console rồi chạy lại destroy |
| `DeleteProtection`/`BucketNotEmpty`/`DBSnapshotAlreadyExists` khi destroy prod | Chưa làm đủ mục 6.2. Làm xong rồi chạy lại destroy (Terraform tiếp tục từ state hiện tại) |
| `state snapshot was created by Terraform v... which is newer` | CI dùng Terraform mới hơn máy bạn (hoặc ngược lại). Đặt Variable `TF_VERSION` khớp với máy bạn |
| Bước upload SARIF báo lỗi | Repo private chưa bật Code Scanning. Không ảnh hưởng kết quả (bước này `continue-on-error`); báo cáo vẫn có ở artifact `checkov-report-<env>` |

## 8. Lưu ý bảo mật

- `tfplan` (artifact lưu 7 ngày) có thể chứa email/IP SSH ở dạng đọc được. Nên dùng **repo private**.
- Bước *Show outputs* ở job apply ghi ARN/IP vào job summary. Repo public thì nên cẩn thận.
- PR từ fork không được chạy plan (không có quyền dùng secrets/OIDC), đây là hành vi cố ý.

## 9. Commit của `deploy.yml` có kích hoạt pipeline này không?

**Không**, vì cả ba lý do độc lập sau:

1. Job `update-manifest` trong `deploy.yml` checkout và `git push` bằng `GITHUB_TOKEN` mặc định. GitHub **không** kích hoạt
   workflow nào (push, PR...) cho các sự kiện sinh ra từ `GITHUB_TOKEN`, trừ `workflow_dispatch` và `repository_dispatch`.
2. Message commit có `[skip ci]`, GitHub bỏ qua mọi workflow kiểu push/PR cho commit đó (không có cú pháp bỏ qua riêng từng
   workflow, `[skip ci]` áp dụng cho tất cả).
3. Commit chỉ sửa file values trong `helm/**`, không khớp `paths:` (`infrastructure/**`, `terraform.yml`).

Nếu sau này `deploy.yml` đổi sang push bằng PAT/GitHub App token (khi đó lý do 1 không còn), lý do 2 và 3 vẫn giữ nguyên
hành vi. Lịch hằng ngày (`schedule`) không chịu ảnh hưởng của `[skip ci]` vì không phải sự kiện push.