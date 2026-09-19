import * as path from 'path';
import * as fs from 'fs';
import { MODULE_METADATA } from '@nestjs/common/constants';

// KHÔNG dùng Test.createTestingModule({ imports: [AppModule] }).compile()
// để test file này — vì AppModule kéo theo TOÀN BỘ business module (Auth,
// User, Catalog, Cart, Order, Payment, Inventory...) và đặc biệt là
// TypeOrmModule.forRootAsync(), vốn sẽ CỐ GẮNG KẾT NỐI POSTGRES THẬT lúc
// compile — không khả thi/không nên làm trong unit test (cần DB thật,
// chậm, dễ flaky). Thay vào đó:
//   1. Mock "TypeOrmModule.forRootAsync" để không thực sự kết nối DB.
//   2. Đọc lại chính xác "options" (bao gồm "useFactory") mà app.module.ts
//      đã truyền vào lúc import — nhờ đó test được ĐÚNG logic build config
//      Postgres thật (bao gồm nhánh Secrets Manager + đọc chứng chỉ SSL)
//      mà không cần bootstrap cả ứng dụng.
//   3. Đọc metadata "@Module()" bằng Reflect để xác nhận đúng danh sách
//      imports/controllers, tương tự cách đã làm với MetricsModule.
jest.mock('@nestjs/typeorm', () => {
  const actual = jest.requireActual('@nestjs/typeorm');
  // "TypeOrmModule" là 1 class với các static method (forRoot/forFeature/
  // forRootAsync) — static method của class KHÔNG enumerable, nên
  // "{...actual.TypeOrmModule}" (spread) sẽ làm MẤT hết các static method
  // khác (chỉ giữ lại property thường). Phải mutate TRỰC TIẾP lên chính
  // class gốc (giữ nguyên reference), chỉ ghi đè mỗi "forRootAsync".
  actual.TypeOrmModule.forRootAsync = jest.fn(() => ({
    module: class MockTypeOrmModule {},
  }));
  return actual;
});

// "getDbCredentialsFromSecretsManager" được useFactory GỌI TRỰC TIẾP (thay
// vì qua configuration.ts như bản trước) — mock hàm này để kiểm soát dữ
// liệu trả về mà không cần gọi AWS Secrets Manager thật. An toàn để mock
// theo cách thông thường (không cần thủ thuật resetModules) vì hàm này chỉ
// được GỌI bên trong useFactory lúc TEST tự invoke, không chạy ngay lúc
// import module.
jest.mock('./config/secrets-manager', () => ({
  getDbCredentialsFromSecretsManager: jest.fn(),
}));

import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { getDbCredentialsFromSecretsManager } from './config/secrets-manager';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CartModule } from './modules/cart/cart.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { StorageModule } from './modules/storage/storage.module';
import { MetricsModule } from './modules/metrics/metrics.module';

const MockedForRootAsync = TypeOrmModule.forRootAsync as jest.Mock;
const mockedGetDbCredentials = getDbCredentialsFromSecretsManager as jest.Mock;

// Lấy "useFactory"/"inject" ra 1 LẦN DUY NHẤT ngay tại đây (module chỉ
// được import 1 lần trong cả file test) — KHÔNG được đọc lại qua
// "MockedForRootAsync.mock.calls[0]" bên trong từng test, vì
// "jest.clearAllMocks()" ở afterEach bên dưới sẽ xoá sạch lịch sử gọi đó,
// khiến các test chạy sau test đầu tiên không còn thấy gì nữa.
const forRootAsyncCallCount = MockedForRootAsync.mock.calls.length;
const forRootAsyncOptions = MockedForRootAsync.mock.calls[0][0];
const useFactory = forRootAsyncOptions.useFactory;

/** ConfigService giả — đọc từ 1 object phẳng theo dot-path. */
function buildConfigService(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('AppModule', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    // Spy sẵn "fs.readFileSync" ở MỌI test (kể cả nhánh mặc định, nơi hàm
    // này không được gọi) — để có thể assert "not.toHaveBeenCalled()" một
    // cách hợp lệ (Jest yêu cầu hàm phải là mock/spy trước khi assert kiểu
    // này). Nhánh secrets-manager sẽ tự ghi đè thêm ".mockReturnValue(...)"
    // trong beforeEach riêng của nó bên dưới.
    jest.spyOn(fs, 'readFileSync');
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
    mockedGetDbCredentials.mockReset();
  });

  describe('metadata — @Module({ imports, controllers })', () => {
    it('đăng ký đúng HealthController', () => {
      const controllers = Reflect.getMetadata(
        MODULE_METADATA.CONTROLLERS,
        AppModule,
      );

      expect(controllers).toEqual([HealthController]);
    });

    it('import đầy đủ các business module (Metrics, Storage, Auth, User, Catalog, Cart, Order, Payment, Inventory)', () => {
      const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule);

      expect(imports).toEqual(
        expect.arrayContaining([
          MetricsModule,
          StorageModule,
          AuthModule,
          UserModule,
          CatalogModule,
          CartModule,
          OrderModule,
          PaymentModule,
          InventoryModule,
        ]),
      );
    });

    it('cấu hình ConfigModule.forRoot({ isGlobal: true }) — để ConfigService dùng được ở mọi module không cần import lại', async () => {
      const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule);
      // ConfigModule.forRoot() trả về Promise<DynamicModule> (vì
      // "configuration.ts" là async factory) — phải await mới lấy được
      // DynamicModule thật để đọc field ".module".
      const resolvedImports = await Promise.all(imports);
      const configModuleImport = resolvedImports.find(
        (imp: { module?: unknown }) => imp?.module === ConfigModule,
      );

      expect(configModuleImport).toBeDefined();
      expect(configModuleImport.global).toBe(true);
    });
  });

  describe('TypeOrmModule.forRootAsync — wiring', () => {
    it('gọi đúng 1 lần với inject: [ConfigService]', () => {
      expect(forRootAsyncCallCount).toBe(1);
      expect(forRootAsyncOptions.inject).toEqual([ConfigService]);
    });
  });

  describe('TypeOrmModule.forRootAsync — useFactory (logic build config Postgres)', () => {
    describe('nhánh mặc định (DB_CREDENTIALS_SOURCE khác "secrets-manager")', () => {
      beforeEach(() => {
        delete process.env.DB_CREDENTIALS_SOURCE;
      });

      it('đọc host/port/username/password/database từ ConfigService', async () => {
        const config = buildConfigService({
          'database.host': 'db.internal',
          'database.port': 5432,
          'database.username': 'app_user',
          'database.password': 'super-secret',
          'database.name': 'electronics_shop',
          nodeEnv: 'production',
        });

        const result = await useFactory(config);

        expect(result).toMatchObject({
          type: 'postgres',
          host: 'db.internal',
          port: 5432,
          username: 'app_user',
          password: 'super-secret',
          database: 'electronics_shop',
        });
      });

      it('tự fallback host/port/username/password/name khi ConfigService trả undefined (phòng hờ, độc lập với fallback trong configuration.ts)', async () => {
        const config = buildConfigService({ nodeEnv: 'production' });

        const result = await useFactory(config);

        expect(result).toMatchObject({
          host: 'localhost',
          port: 5432,
          username: 'postgres',
          password: 'postgres',
          database: 'electronics_shop',
        });
      });

      it('KHÔNG gọi getDbCredentialsFromSecretsManager()', async () => {
        const config = buildConfigService({ nodeEnv: 'production' });

        await useFactory(config);

        expect(mockedGetDbCredentials).not.toHaveBeenCalled();
      });

      it('KHÔNG có field "ssl" trong config trả về (không đọc chứng chỉ khi không dùng Secrets Manager)', async () => {
        const config = buildConfigService({ nodeEnv: 'production' });

        const result = await useFactory(config);

        expect(result.ssl).toBeUndefined();
        expect(fs.readFileSync).not.toHaveBeenCalled();
      });
    });

    describe('nhánh DB_CREDENTIALS_SOURCE=secrets-manager', () => {
      beforeEach(() => {
        process.env.DB_CREDENTIALS_SOURCE = 'secrets-manager';
        mockedGetDbCredentials.mockResolvedValue({
          host: 'rds.internal',
          port: 5432,
          username: 'app_user',
          password: 'secret-from-aws',
          name: 'shop_db',
        });
        jest
          .spyOn(fs, 'readFileSync')
          .mockReturnValue(
            Buffer.from(
              '-----BEGIN CERTIFICATE-----FAKE-----END CERTIFICATE-----',
            ),
          );
      });

      it('gọi getDbCredentialsFromSecretsManager() và dùng kết quả làm database config (KHÔNG đọc từ ConfigService)', async () => {
        const config = buildConfigService({
          'database.host': 'khong-duoc-dung-gia-tri-nay',
          nodeEnv: 'production',
        });

        const result = await useFactory(config);

        expect(mockedGetDbCredentials).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({
          host: 'rds.internal',
          port: 5432,
          username: 'app_user',
          password: 'secret-from-aws',
          database: 'shop_db',
        });
      });

      it('đọc CA bundle qua fs.readFileSync và gắn vào ssl.ca, ssl.rejectUnauthorized = true', async () => {
        const config = buildConfigService({ nodeEnv: 'production' });

        const result = await useFactory(config);

        // Dùng path.join() để build chuỗi kỳ vọng thay vì hardcode dấu "/"
        // — trên Windows, path.join() nối bằng "\", nên hardcode "/" sẽ
        // luôn fail khi chạy test trên máy Windows (dù code CHẠY ĐÚNG,
        // chỉ là assertion sai định dạng path theo hệ điều hành).
        expect(fs.readFileSync).toHaveBeenCalledWith(
          expect.stringContaining(path.join('certs', 'global-bundle.pem')),
        );
        expect(result.ssl).toEqual({
          ca: '-----BEGIN CERTIFICATE-----FAKE-----END CERTIFICATE-----',
          rejectUnauthorized: true,
        });
      });

      it('đọc chứng chỉ từ đường dẫn TƯƠNG ĐỐI so với process.cwd() (đúng WORKDIR trong Docker lẫn thư mục backend/ lúc dev)', async () => {
        const config = buildConfigService({ nodeEnv: 'production' });

        await useFactory(config);

        const calledPath = (fs.readFileSync as jest.Mock).mock.calls[0][0];
        expect(calledPath.startsWith(process.cwd())).toBe(true);
      });

      it('không nuốt lỗi khi getDbCredentialsFromSecretsManager() reject (vd thiếu DB_SECRET_ARN)', async () => {
        mockedGetDbCredentials.mockRejectedValue(
          new Error(
            'DB_CREDENTIALS_SOURCE=secrets-manager nhưng thiếu biến DB_SECRET_ARN.',
          ),
        );
        const config = buildConfigService({ nodeEnv: 'production' });

        await expect(useFactory(config)).rejects.toThrow('DB_SECRET_ARN');
      });

      it('không nuốt lỗi khi đọc file chứng chỉ SSL thất bại (vd file chưa được mount vào container)', async () => {
        (fs.readFileSync as jest.Mock).mockImplementation(() => {
          throw new Error('ENOENT: no such file or directory');
        });
        const config = buildConfigService({ nodeEnv: 'production' });

        await expect(useFactory(config)).rejects.toThrow('ENOENT');
      });
    });

    describe('các field không phụ thuộc nguồn database (đúng ở CẢ 2 nhánh)', () => {
      it('bật "synchronize" ở mọi môi trường KHÁC "production"', async () => {
        delete process.env.DB_CREDENTIALS_SOURCE;
        const config = buildConfigService({ nodeEnv: 'development' });

        const result = await useFactory(config);

        expect(result.synchronize).toBe(true);
      });

      it('tắt "synchronize" khi nodeEnv là "production"', async () => {
        delete process.env.DB_CREDENTIALS_SOURCE;
        const config = buildConfigService({ nodeEnv: 'production' });

        const result = await useFactory(config);

        expect(result.synchronize).toBe(false);
      });

      it('chỉ bật "logging" khi nodeEnv CHÍNH XÁC là "development"', async () => {
        delete process.env.DB_CREDENTIALS_SOURCE;
        const dev = buildConfigService({ nodeEnv: 'development' });
        expect((await useFactory(dev)).logging).toBe(true);

        const staging = buildConfigService({ nodeEnv: 'staging' });
        expect((await useFactory(staging)).logging).toBe(false);
      });

      it('khai báo entities theo glob pattern "*.entity.{ts,js}" quét toàn bộ src', async () => {
        delete process.env.DB_CREDENTIALS_SOURCE;
        const config = buildConfigService({ nodeEnv: 'production' });

        const result = await useFactory(config);

        expect(result.entities).toEqual([
          expect.stringContaining('/**/*.entity{.ts,.js}'),
        ]);
      });
    });
  });
});
