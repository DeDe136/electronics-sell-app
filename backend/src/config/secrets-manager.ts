import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

/**
 * File MỚI — chỉ được gọi khi biến môi trường DB_CREDENTIALS_SOURCE=secrets-manager
 * (xem configuration.ts). Không ảnh hưởng gì tới luồng local/k3s cũ (đọc thẳng
 * DB_HOST/DB_PASSWORD từ env), vì nhánh đó vẫn giữ nguyên logic cũ 100%.
 *
 * "SecretsManagerClient" KHÔNG truyền "credentials" tường minh — giống
 * StorageService, SDK tự lấy credentials tạm thời qua IRSA
 * (AWS_ROLE_ARN/AWS_WEB_IDENTITY_TOKEN_FILE mà EKS tiêm sẵn vào pod backend,
 * xem Bước 6 — OIDC + IRSA). Không hardcode access key/secret key ở đây.
 */

export interface DbCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
}

let cached: DbCredentials | null = null;

export async function getDbCredentialsFromSecretsManager(): Promise<DbCredentials> {
  // Cache trong bộ nhớ process — tránh gọi lại Secrets Manager mỗi lần
  // ConfigService được resolve (Nest có thể gọi factory 1 lần lúc khởi
  // động, nhưng cache vẫn hữu ích nếu sau này có health-check tự reload).
  if (cached) return cached;

  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) {
    throw new Error(
      'DB_CREDENTIALS_SOURCE=secrets-manager nhưng thiếu biến DB_SECRET_ARN.',
    );
  }

  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || 'ap-southeast-1',
  });

  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );

  if (!response.SecretString) {
    throw new Error(
      `Secret ${secretArn} không có SecretString hợp lệ (có thể là secret dạng binary).`,
    );
  }

  const secret = JSON.parse(response.SecretString);

  // RDS-managed secret (bật "Manage master credentials in Secrets Manager")
  // luôn có sẵn username/password/host/port; "dbname" đôi khi KHÔNG có sẵn
  // tuỳ cách bạn bật tính năng này — fallback về DB_NAME (biến môi trường
  // thường, không nhạy cảm) để tránh lỗi nếu thiếu field đó.
  cached = {
    host: secret.host,
    port: Number(secret.port) || 5432,
    username: secret.username,
    password: secret.password,
    name: secret.dbname || process.env.DB_NAME || 'electronics_shop',
  };

  return cached;
}
