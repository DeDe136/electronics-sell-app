import configuration from './configuration';

describe('config/configuration.ts', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('nhánh mặc định (KHÔNG set DB_CREDENTIALS_SOURCE) — đọc thẳng từ env', () => {
    it('đọc database credentials từ DB_HOST/DB_PORT/... khi không set DB_CREDENTIALS_SOURCE', async () => {
      delete process.env.DB_CREDENTIALS_SOURCE;
      process.env.DB_HOST = 'db.local';
      process.env.DB_PORT = '5433';
      process.env.DB_USERNAME = 'user1';
      process.env.DB_PASSWORD = 'pass1';
      process.env.DB_NAME = 'shop';

      const config = await configuration();

      expect(config.database).toEqual({
        host: 'db.local',
        port: 5433,
        username: 'user1',
        password: 'pass1',
        name: 'shop',
      });
    });

    it('dùng giá trị mặc định cho database khi thiếu toàn bộ biến môi trường DB_*', async () => {
      delete process.env.DB_CREDENTIALS_SOURCE;
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;
      delete process.env.DB_USERNAME;
      delete process.env.DB_PASSWORD;
      delete process.env.DB_NAME;

      const config = await configuration();

      expect(config.database).toEqual({
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'postgres',
        name: 'electronics_shop',
      });
    });

    it('fallback database.port về 5432 khi DB_PORT là chuỗi không phải số hợp lệ', async () => {
      delete process.env.DB_CREDENTIALS_SOURCE;
      process.env.DB_PORT = 'khong-phai-so';

      const config = await configuration();

      expect(config.database.port).toBe(5432);
    });

    it('KHÔNG gọi Secrets Manager khi DB_CREDENTIALS_SOURCE là giá trị khác (không phải "secrets-manager")', async () => {
      process.env.DB_CREDENTIALS_SOURCE = 'env';

      const config = await configuration();

      expect(config.database.host).toBe(process.env.DB_HOST || 'localhost');
    });

    it('vẫn giữ configuration sync và không gọi Secrets Manager khi DB_CREDENTIALS_SOURCE=secrets-manager', async () => {
      process.env.DB_CREDENTIALS_SOURCE = 'secrets-manager';
      process.env.DB_HOST = 'rds.from.env';
      process.env.DB_PORT = '5432';

      const config = await configuration();

      expect(config.database).toMatchObject({
        host: 'rds.from.env',
        port: 5432,
      });
    });
  });

  describe('các field khác không liên quan tới database', () => {
    it('trả về đúng port/nodeEnv/jwt từ biến môi trường', async () => {
      process.env.PORT = '4000';
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'my-secret';
      process.env.JWT_EXPIRES_IN = '1d';

      const config = await configuration();

      expect(config.port).toBe(4000);
      expect(config.nodeEnv).toBe('production');
      expect(config.jwt).toEqual({ secret: 'my-secret', expiresIn: '1d' });
    });

    it('trả về đúng cấu hình storage (aws + minio) từ biến môi trường', async () => {
      process.env.STORAGE_PROVIDER = 'aws';
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_ACCESS_KEY_ID = 'AKIA...';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret';
      process.env.AWS_S3_BUCKET = 'my-bucket';
      process.env.MINIO_ENDPOINT = 'http://minio:9000';
      process.env.MINIO_ACCESS_KEY = 'minio-key';
      process.env.MINIO_SECRET_KEY = 'minio-secret';
      process.env.MINIO_BUCKET = 'minio-bucket';

      const config = await configuration();

      expect(config.storage).toEqual({
        provider: 'aws',
        aws: {
          region: 'us-east-1',
          accessKeyId: 'AKIA...',
          secretAccessKey: 'secret',
          bucket: 'my-bucket',
        },
        minio: {
          endpoint: 'http://minio:9000',
          accessKey: 'minio-key',
          secretKey: 'minio-secret',
          bucket: 'minio-bucket',
        },
      });
    });

    it('dùng giá trị mặc định cho port/storage khi thiếu biến môi trường', async () => {
      delete process.env.PORT;
      delete process.env.NODE_ENV;
      delete process.env.STORAGE_PROVIDER;

      const config = await configuration();

      expect(config.port).toBe(3001);
      expect(config.nodeEnv).toBe('development');
      expect(config.storage.provider).toBe('minio');
    });

    it('fallback config.port về 3001 khi PORT là chuỗi không phải số hợp lệ', async () => {
      process.env.PORT = 'khong-phai-so';

      const config = await configuration();

      expect(config.port).toBe(3001);
    });
  });
});
