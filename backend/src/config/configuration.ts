// Factory này phải giữ sync để ConfigModule nạp cấu hình thường ổn định.
// Database credentials cần gọi Secrets Manager sẽ được xử lý trực tiếp trong
// TypeOrmModule.forRootAsync(), nơi Nest có hỗ trợ async factory rõ ràng.
export default () => {
  return {
    port: parseInt(process.env.PORT ?? '3001', 10) || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      name: process.env.DB_NAME || 'electronics_shop',
    },
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
