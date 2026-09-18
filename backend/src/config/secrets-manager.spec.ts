import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

// Chỉ mock "SecretsManagerClient" (để kiểm soát network call), GIỮ NGUYÊN
// "GetSecretValueCommand" thật — vì nếu auto-mock luôn cả class này,
// constructor thật (nơi lưu params vào ".input") sẽ không chạy, khiến
// không thể assert được SecretId đã truyền đúng hay chưa.
jest.mock('@aws-sdk/client-secrets-manager', () => {
  const actual = jest.requireActual('@aws-sdk/client-secrets-manager');
  return { ...actual, SecretsManagerClient: jest.fn() };
});

/**
 * "cached" trong secrets-manager.ts là biến module-scope (không export) —
 * để test được cả nhánh "chưa cache" lẫn "đã cache", mỗi test phải
 * jest.resetModules() rồi require() lại module này, đảm bảo mỗi test bắt
 * đầu với "cached = null" như lúc process mới khởi động.
 *
 * LƯU Ý QUAN TRỌNG: jest.resetModules() cũng nạp lại chính module
 * "@aws-sdk/client-secrets-manager" (đã bị jest.mock() tự động mock) — nên
 * KHÔNG thể dùng "SecretsManagerClient" import tĩnh ở đầu file để
 * mockImplementation (nó trỏ tới bản module CŨ, trước lúc reset). Phải
 * require() lại CẢ HAI module (SDK giả lập + module đích) TRONG CÙNG 1
 * beforeEach, sau resetModules(), để chúng cùng dùng chung 1 bản module
 * registry mới.
 *
 * LƯU Ý VỀ NGUỒN DỮ LIỆU (cập nhật): chỉ "username"/"password" lấy từ
 * secret (SecretString trả về từ Secrets Manager) — "host"/"port"/"name"
 * giờ lấy thẳng từ biến môi trường DB_HOST/DB_PORT/DB_NAME, KHÔNG còn đọc
 * từ secret nữa (khác bản trước). RDS-managed secret không phải lúc nào
 * cũng có sẵn "host"/"dbname" tuỳ cách bật tính năng, nên tách phần này ra
 * khỏi secret để không phụ thuộc vào cấu trúc secret cụ thể.
 */
describe('config/secrets-manager.ts — getDbCredentialsFromSecretsManager()', () => {
  const ORIGINAL_ENV = { ...process.env };
  let sendMock: jest.Mock;
  let MockedSecretsManagerClient: jest.MockedClass<typeof SecretsManagerClient>;
  let getDbCredentialsFromSecretsManager: () => Promise<unknown>;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };

    sendMock = jest.fn();
    // Bắt buộc dùng require() động (không thể "import" tĩnh) vì cần require
    // LẠI module này SAU jest.resetModules() để lấy đúng bản mock hiện hành
    // (xem giải thích chi tiết ở comment đầu file).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const awsSdk = require('@aws-sdk/client-secrets-manager');
    MockedSecretsManagerClient = awsSdk.SecretsManagerClient;
    MockedSecretsManagerClient.mockImplementation(
      () => ({ send: sendMock }) as unknown as SecretsManagerClient,
    );

    ({ getDbCredentialsFromSecretsManager } = require('./secrets-manager'));
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('ném lỗi rõ ràng khi thiếu DB_SECRET_ARN', async () => {
    delete process.env.DB_SECRET_ARN;

    await expect(getDbCredentialsFromSecretsManager()).rejects.toThrow(
      'DB_CREDENTIALS_SOURCE=secrets-manager nhưng thiếu biến DB_SECRET_ARN.',
    );
  });

  it('gọi GetSecretValueCommand với đúng SecretId lấy từ DB_SECRET_ARN', async () => {
    process.env.DB_SECRET_ARN =
      'arn:aws:secretsmanager:ap-southeast-1:123:secret:db';
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({ username: 'app', password: 'pw' }),
    });

    await getDbCredentialsFromSecretsManager();

    expect(sendMock).toHaveBeenCalledTimes(1);
    const commandArg = sendMock.mock.calls[0][0];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sdk = require('@aws-sdk/client-secrets-manager');
    expect(commandArg).toBeInstanceOf(sdk.GetSecretValueCommand);
    expect(commandArg.input).toEqual({
      SecretId: 'arn:aws:secretsmanager:ap-southeast-1:123:secret:db',
    });
  });

  it('khởi tạo SecretsManagerClient KHÔNG truyền "credentials" tường minh (để SDK tự lấy qua IRSA)', async () => {
    process.env.DB_SECRET_ARN = 'arn:test';
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({ username: 'u', password: 'p' }),
    });

    await getDbCredentialsFromSecretsManager();

    expect(MockedSecretsManagerClient).toHaveBeenCalledWith(
      expect.not.objectContaining({ credentials: expect.anything() }),
    );
  });

  it('dùng region từ AWS_REGION, fallback "ap-southeast-1" khi không set', async () => {
    process.env.DB_SECRET_ARN = 'arn:test';
    delete process.env.AWS_REGION;
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({ username: 'u', password: 'p' }),
    });

    await getDbCredentialsFromSecretsManager();

    expect(MockedSecretsManagerClient).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'ap-southeast-1' }),
    );
  });

  it('dùng region ap-southeast-1 khi AWS_REGION được set giá trị khác', async () => {
    process.env.DB_SECRET_ARN = 'arn:test';
    process.env.AWS_REGION = 'us-east-1';
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({ username: 'u', password: 'p' }),
    });

    await getDbCredentialsFromSecretsManager();

    expect(MockedSecretsManagerClient).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'us-east-1' }),
    );
  });

  it('lấy "username"/"password" từ SecretString, "host"/"port"/"name" từ biến môi trường', async () => {
    process.env.DB_SECRET_ARN = 'arn:test';
    process.env.DB_HOST = 'rds.internal';
    process.env.DB_PORT = '5433';
    process.env.DB_NAME = 'shop_db';
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({
        username: 'app_user',
        password: 'super-secret',
        // "host"/"port"/"dbname" nếu secret CÓ trả về cũng KHÔNG được dùng
        // nữa — cố tình đặt giá trị khác để khẳng định điều đó.
        host: 'khong-duoc-dung-gia-tri-nay',
        port: 9999,
        dbname: 'khong-duoc-dung-ten-nay',
      }),
    });

    const result = await getDbCredentialsFromSecretsManager();

    expect(result).toEqual({
      host: 'rds.internal',
      port: 5433,
      username: 'app_user',
      password: 'super-secret',
      name: 'shop_db',
    });
  });

  it('fallback "host" về "localhost" khi thiếu DB_HOST', async () => {
    process.env.DB_SECRET_ARN = 'arn:test';
    delete process.env.DB_HOST;
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({ username: 'u', password: 'p' }),
    });

    const result = (await getDbCredentialsFromSecretsManager()) as {
      host: string;
    };

    expect(result.host).toBe('localhost');
  });

  it('fallback "name" về "electronics_shop" khi thiếu DB_NAME', async () => {
    process.env.DB_SECRET_ARN = 'arn:test';
    delete process.env.DB_NAME;
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({ username: 'u', password: 'p' }),
    });

    const result = (await getDbCredentialsFromSecretsManager()) as {
      name: string;
    };

    expect(result.name).toBe('electronics_shop');
  });

  it('fallback "port" về 5432 khi thiếu DB_PORT', async () => {
    process.env.DB_SECRET_ARN = 'arn:test';
    delete process.env.DB_PORT;
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({ username: 'u', password: 'p' }),
    });

    const result = (await getDbCredentialsFromSecretsManager()) as {
      port: number;
    };

    expect(result.port).toBe(5432);
  });

  it('fallback "port" về 5432 khi DB_PORT là chuỗi không phải số hợp lệ', async () => {
    process.env.DB_SECRET_ARN = 'arn:test';
    process.env.DB_PORT = 'khong-phai-so';
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({ username: 'u', password: 'p' }),
    });

    const result = (await getDbCredentialsFromSecretsManager()) as {
      port: number;
    };

    expect(result.port).toBe(5432);
  });

  it('ném lỗi rõ ràng khi response không có SecretString (secret dạng binary)', async () => {
    process.env.DB_SECRET_ARN = 'arn:test';
    sendMock.mockResolvedValue({ SecretString: undefined });

    await expect(getDbCredentialsFromSecretsManager()).rejects.toThrow(
      'arn:test không có SecretString hợp lệ (có thể là secret dạng binary).',
    );
  });

  it('CACHE kết quả — gọi lần 2 KHÔNG gọi lại Secrets Manager', async () => {
    process.env.DB_SECRET_ARN = 'arn:test';
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({ username: 'u', password: 'p' }),
    });

    const first = await getDbCredentialsFromSecretsManager();
    const second = await getDbCredentialsFromSecretsManager();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('không nuốt lỗi khi Secrets Manager trả lỗi (vd AccessDenied, secret không tồn tại)', async () => {
    process.env.DB_SECRET_ARN = 'arn:test';
    sendMock.mockRejectedValue(new Error('AccessDeniedException'));

    await expect(getDbCredentialsFromSecretsManager()).rejects.toThrow(
      'AccessDeniedException',
    );
  });
});
