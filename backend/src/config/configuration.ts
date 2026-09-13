import { getDbCredentialsFromSecretsManager } from './secrets-manager';

// (MỚI) @nestjs/config cho phép factory trong "load: [...]" trả về Promise —
// không cần sửa gì ở app.module.ts. Mặc định (KHÔNG set
// DB_CREDENTIALS_SOURCE) đi đúng nhánh cũ, đọc thẳng DB_HOST/DB_PASSWORD từ
// env y hệt trước giờ — giữ nguyên 100% hành vi cho local/docker-compose/k3s.
export default async () => {
  const database =
    process.env.DB_CREDENTIALS_SOURCE === 'secrets-manager'
      ? await getDbCredentialsFromSecretsManager()
      : {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT ?? '5432', 10) || 5432,
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          name: process.env.DB_NAME || 'electronics_shop',
        };

  return {
    port: parseInt(process.env.PORT ?? '3001', 10) || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    database,
    jwt: {
      secret: process.env.JWT_SECRET || 'fallback-secret',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    storage: {
      provider: process.env.STORAGE_PROVIDER || 'minio',
      // AWS S3
      aws: {
        region: process.env.AWS_REGION || 'ap-southeast-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        bucket: process.env.AWS_S3_BUCKET || 'electronics-shop',
      },
      // MinIO
      minio: {
        endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        bucket: process.env.MINIO_BUCKET || 'electronics-shop',
      },
    },
  };
};