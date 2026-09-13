import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './storage.service';

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn() };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const MockedS3Client = S3Client as jest.MockedClass<typeof S3Client>;
const mockedGetSignedUrl = getSignedUrl as jest.Mock;

/** ConfigService giả — đọc từ 1 object phẳng theo dot-path, giống cách
 * @nestjs/config thật hoạt động với "config.get('storage.aws.bucket')". */
function buildConfigService(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('StorageService', () => {
  let sendMock: jest.Mock;

  beforeEach(() => {
    sendMock = jest.fn();
    MockedS3Client.mockImplementation(
      () => ({ send: sendMock }) as unknown as S3Client,
    );
    mockedGetSignedUrl.mockResolvedValue('https://signed-url.example.com');
    // StorageService dùng Nest Logger (console thật) để log kết nối/upload —
    // mock đi để output test sạch, không assert nội dung log (chỉ log phụ
    // trợ vận hành, không phải hành vi nghiệp vụ cần test).
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor — nhánh MinIO (mặc định)', () => {
    it('dùng "minio" làm provider mặc định khi thiếu "storage.provider"', () => {
      const config = buildConfigService({});
      new StorageService(config);

      expect(MockedS3Client).toHaveBeenCalledWith(
        expect.objectContaining({ forcePathStyle: true }),
      );
    });

    it('cấu hình endpoint/credentials MinIO từ config, có fallback hợp lý', () => {
      const config = buildConfigService({
        'storage.provider': 'minio',
        'storage.minio.endpoint': 'http://minio.internal:9000',
        'storage.minio.accessKey': 'my-key',
        'storage.minio.secretKey': 'my-secret',
      });

      new StorageService(config);

      expect(MockedS3Client).toHaveBeenCalledWith({
        endpoint: 'http://minio.internal:9000',
        region: 'us-east-1',
        credentials: { accessKeyId: 'my-key', secretAccessKey: 'my-secret' },
        forcePathStyle: true,
      });
    });

    it('dùng giá trị mặc định (localhost:9000, minioadmin/minioadmin) khi thiếu cấu hình MinIO', () => {
      const config = buildConfigService({ 'storage.provider': 'minio' });

      new StorageService(config);

      expect(MockedS3Client).toHaveBeenCalledWith({
        endpoint: 'http://localhost:9000',
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'minioadmin',
          secretAccessKey: 'minioadmin',
        },
        forcePathStyle: true,
      });
    });
  });

  describe('constructor — nhánh AWS S3', () => {
    it('truyền "credentials" tường minh khi có đủ accessKeyId/secretAccessKey trong config', () => {
      const config = buildConfigService({
        'storage.provider': 'aws',
        'storage.aws.region': 'ap-southeast-1',
        'storage.aws.accessKeyId': 'AKIA_TEST',
        'storage.aws.secretAccessKey': 'secret_test',
      });

      new StorageService(config);

      expect(MockedS3Client).toHaveBeenCalledWith({
        region: 'ap-southeast-1',
        credentials: {
          accessKeyId: 'AKIA_TEST',
          secretAccessKey: 'secret_test',
        },
      });
    });

    it('KHÔNG truyền "credentials" khi thiếu accessKeyId/secretAccessKey — để SDK tự nhận IRSA trên EKS', () => {
      const config = buildConfigService({
        'storage.provider': 'aws',
        'storage.aws.region': 'ap-southeast-1',
        // không có accessKeyId/secretAccessKey — đúng kịch bản chạy trên EKS
      });

      new StorageService(config);

      expect(MockedS3Client).toHaveBeenCalledWith({ region: 'ap-southeast-1' });
      const callArg = MockedS3Client.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect('credentials' in callArg).toBe(false);
    });

    it('KHÔNG truyền "credentials" khi CHỈ có accessKeyId mà thiếu secretAccessKey (tránh truyền object credentials rỗng/nửa vời)', () => {
      const config = buildConfigService({
        'storage.provider': 'aws',
        'storage.aws.accessKeyId': 'AKIA_ONLY',
        // thiếu secretAccessKey
      });

      new StorageService(config);

      const callArg = MockedS3Client.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect('credentials' in callArg).toBe(false);
    });

    it('fallback region "ap-southeast-1" và bucket "electronics-shop" khi thiếu config', () => {
      const config = buildConfigService({ 'storage.provider': 'aws' });

      new StorageService(config);

      expect(MockedS3Client).toHaveBeenCalledWith(
        expect.objectContaining({ region: 'ap-southeast-1' }),
      );
    });
  });

  describe('checkConnection()', () => {
    it('log thành công (không throw) khi HeadBucketCommand trả về OK', async () => {
      const config = buildConfigService({
        'storage.provider': 'minio',
        'storage.minio.bucket': 'shop-bucket',
      });
      const service = new StorageService(config);
      sendMock.mockResolvedValue({});

      await expect(service.checkConnection()).resolves.toBeUndefined();
      expect(sendMock).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
    });

    it('không throw khi bucket không tồn tại (lỗi NotFound) — chỉ log warning', async () => {
      const config = buildConfigService({ 'storage.provider': 'minio' });
      const service = new StorageService(config);
      const notFoundError = Object.assign(new Error('not found'), {
        name: 'NotFound',
      });
      sendMock.mockRejectedValue(notFoundError);

      await expect(service.checkConnection()).resolves.toBeUndefined();
    });

    it('không throw khi lỗi có $metadata.httpStatusCode = 404', async () => {
      const config = buildConfigService({ 'storage.provider': 'minio' });
      const service = new StorageService(config);
      sendMock.mockRejectedValue({
        $metadata: { httpStatusCode: 404 },
        message: 'not found',
      });

      await expect(service.checkConnection()).resolves.toBeUndefined();
    });

    it('log thành công khi HeadBucketCommand trả về OK (nhánh AWS S3)', async () => {
      const config = buildConfigService({
        'storage.provider': 'aws',
        'storage.aws.region': 'ap-southeast-1',
      });
      const service = new StorageService(config);
      sendMock.mockResolvedValue({});

      await expect(service.checkConnection()).resolves.toBeUndefined();
      expect(sendMock).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
    });

    it('không throw khi lỗi kết nối khác (vd network error) — chỉ log error, không crash app', async () => {
      const config = buildConfigService({ 'storage.provider': 'aws' });
      const service = new StorageService(config);
      sendMock.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.checkConnection()).resolves.toBeUndefined();
    });

    it('không throw ngay cả khi promise reject với giá trị không phải Error (vd undefined) — optional chaining phải an toàn', async () => {
      const config = buildConfigService({ 'storage.provider': 'minio' });
      const service = new StorageService(config);
      sendMock.mockRejectedValue(undefined);

      await expect(service.checkConnection()).resolves.toBeUndefined();
    });

    it('onModuleInit() tự động gọi checkConnection()', async () => {
      const config = buildConfigService({ 'storage.provider': 'minio' });
      const service = new StorageService(config);
      const spy = jest
        .spyOn(service, 'checkConnection')
        .mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('uploadFile() / buildPublicUrl()', () => {
    it('trả về URL dạng "endpoint/bucket/key" khi provider là MinIO', async () => {
      const config = buildConfigService({
        'storage.provider': 'minio',
        'storage.minio.endpoint': 'http://minio.internal:9000',
        'storage.minio.bucket': 'shop-bucket',
      });
      const service = new StorageService(config);
      sendMock.mockResolvedValue({});

      const file = {
        originalname: 'avatar.png',
        mimetype: 'image/png',
        buffer: Buffer.from('fake'),
      } as Express.Multer.File;

      const result = await service.uploadFile(file, 'avatars');

      expect(result.bucket).toBe('shop-bucket');
      expect(result.key).toMatch(/^avatars\/.+\.png$/);
      expect(result.url).toBe(
        `http://minio.internal:9000/shop-bucket/${result.key}`,
      );
    });

    it('trả về URL dạng proxy "/api/images/<key>" khi provider là AWS S3 (bucket private)', async () => {
      const config = buildConfigService({
        'storage.provider': 'aws',
        'storage.aws.bucket': 'private-bucket',
      });
      const service = new StorageService(config);
      sendMock.mockResolvedValue({});

      const file = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake'),
      } as Express.Multer.File;

      const result = await service.uploadFile(file, 'products');

      expect(result.url).toBe(`/api/images/${encodeURIComponent(result.key)}`);
    });

    it('dùng folder mặc định "uploads" khi không truyền folder', async () => {
      const config = buildConfigService({ 'storage.provider': 'minio' });
      const service = new StorageService(config);
      sendMock.mockResolvedValue({});

      const file = {
        originalname: 'file.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('fake'),
      } as Express.Multer.File;

      const result = await service.uploadFile(file);

      expect(result.key).toMatch(/^uploads\/.+\.pdf$/);
    });
  });

  describe('uploadFiles()', () => {
    it('upload nhiều file song song và trả về đúng số lượng kết quả', async () => {
      const config = buildConfigService({ 'storage.provider': 'minio' });
      const service = new StorageService(config);
      sendMock.mockResolvedValue({});

      const files = [
        {
          originalname: 'a.png',
          mimetype: 'image/png',
          buffer: Buffer.from('a'),
        },
        {
          originalname: 'b.png',
          mimetype: 'image/png',
          buffer: Buffer.from('b'),
        },
      ] as Express.Multer.File[];

      const results = await service.uploadFiles(files, 'gallery');

      expect(results).toHaveLength(2);
      expect(results[0].key).toMatch(/^gallery\//);
      expect(results[1].key).toMatch(/^gallery\//);
    });

    it('dùng folder mặc định "uploads" khi gọi uploadFiles() không truyền folder', async () => {
      const config = buildConfigService({ 'storage.provider': 'minio' });
      const service = new StorageService(config);
      sendMock.mockResolvedValue({});

      const files = [
        {
          originalname: 'c.png',
          mimetype: 'image/png',
          buffer: Buffer.from('c'),
        },
      ] as Express.Multer.File[];

      const results = await service.uploadFiles(files);

      expect(results[0].key).toMatch(/^uploads\//);
    });
  });

  describe('deleteFile()', () => {
    it('gọi DeleteObjectCommand với đúng bucket/key', async () => {
      const config = buildConfigService({
        'storage.provider': 'minio',
        'storage.minio.bucket': 'shop-bucket',
      });
      const service = new StorageService(config);
      sendMock.mockResolvedValue({});

      await service.deleteFile('uploads/abc.png');

      const commandArg = sendMock.mock.calls[0][0];
      expect(commandArg.input).toEqual({
        Bucket: 'shop-bucket',
        Key: 'uploads/abc.png',
      });
    });
  });

  describe('getPresignedUploadUrl() / getSignedReadUrl()', () => {
    it('trả về signed URL cho upload với đúng expiresIn truyền vào', async () => {
      const config = buildConfigService({ 'storage.provider': 'minio' });
      const service = new StorageService(config);

      const url = await service.getPresignedUploadUrl(
        'uploads/abc.png',
        'image/png',
        120,
      );

      expect(url).toBe('https://signed-url.example.com');
      expect(mockedGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 120 },
      );
    });

    it('dùng expiresIn mặc định 300 giây cho getPresignedUploadUrl() khi không truyền', async () => {
      const config = buildConfigService({ 'storage.provider': 'minio' });
      const service = new StorageService(config);

      await service.getPresignedUploadUrl('uploads/abc.png', 'image/png');

      expect(mockedGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 300 },
      );
    });

    it('dùng expiresIn mặc định 3600 giây cho getSignedReadUrl() khi không truyền', async () => {
      const config = buildConfigService({ 'storage.provider': 'minio' });
      const service = new StorageService(config);

      await service.getSignedReadUrl('uploads/abc.png');

      expect(mockedGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 3600 },
      );
    });
  });
});
