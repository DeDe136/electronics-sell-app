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
//      Postgres thật (kể cả dòng console.log debug mới thêm) mà không cần
//      bootstrap cả ứng dụng.
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

import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
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

/** ConfigService giả — đọc từ 1 object phẳng theo dot-path. */
function buildConfigService(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('AppModule', () => {
  beforeEach(() => {
    // useFactory có dòng console.log('TYPEORM_DB_CONFIG', ...) chạy MỖI
    // LẦN gọi — mock đi để output test sạch ở các test không quan tâm tới
    // log (chỉ test riêng "log TYPEORM_DB_CONFIG..." mới tự spy/assert nội
    // dung, xem bên dưới).
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
      expect(MockedForRootAsync).toHaveBeenCalledTimes(1);
      const options = MockedForRootAsync.mock.calls[0][0];

      expect(options.inject).toEqual([ConfigService]);
    });
  });

  describe('TypeOrmModule.forRootAsync — useFactory (logic build config Postgres)', () => {
    const getUseFactory = () => MockedForRootAsync.mock.calls[0][0].useFactory;

    it('trả về type "postgres" và đầy đủ host/port/username/password/database từ ConfigService', () => {
      const config = buildConfigService({
        'database.host': 'db.internal',
        'database.port': 5432,
        'database.username': 'app_user',
        'database.password': 'super-secret',
        'database.name': 'electronics_shop',
        nodeEnv: 'production',
      });

      const result = getUseFactory()(config);

      expect(result).toMatchObject({
        type: 'postgres',
        host: 'db.internal',
        port: 5432,
        username: 'app_user',
        password: 'super-secret',
        database: 'electronics_shop',
      });
    });

    it('bật "synchronize" ở mọi môi trường KHÁC "production" (vd development, test, staging)', () => {
      const config = buildConfigService({ nodeEnv: 'development' });
      expect(getUseFactory()(config).synchronize).toBe(true);

      const configStaging = buildConfigService({ nodeEnv: 'staging' });
      expect(getUseFactory()(configStaging).synchronize).toBe(true);
    });

    it('tắt "synchronize" khi nodeEnv là "production" — tránh auto-migrate schema trên môi trường thật', () => {
      const config = buildConfigService({ nodeEnv: 'production' });

      expect(getUseFactory()(config).synchronize).toBe(false);
    });

    it('chỉ bật "logging" khi nodeEnv CHÍNH XÁC là "development"', () => {
      const dev = buildConfigService({ nodeEnv: 'development' });
      expect(getUseFactory()(dev).logging).toBe(true);

      const prod = buildConfigService({ nodeEnv: 'production' });
      expect(getUseFactory()(prod).logging).toBe(false);

      const staging = buildConfigService({ nodeEnv: 'staging' });
      expect(getUseFactory()(staging).logging).toBe(false);
    });

    it('khai báo entities theo glob pattern "*.entity.{ts,js}" quét toàn bộ src', () => {
      const config = buildConfigService({ nodeEnv: 'production' });

      const result = getUseFactory()(config);

      expect(result.entities).toEqual([
        expect.stringContaining('/**/*.entity{.ts,.js}'),
      ]);
    });

    it('log "TYPEORM_DB_CONFIG" ra console để debug lúc deploy, KHÔNG lộ "password" trong log', () => {
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
      const config = buildConfigService({
        'database.host': 'db.internal',
        'database.port': 5432,
        'database.username': 'app_user',
        'database.password': 'super-secret-khong-duoc-lo',
        'database.name': 'electronics_shop',
        nodeEnv: 'production',
      });

      getUseFactory()(config);

      expect(consoleLogSpy).toHaveBeenCalledWith('TYPEORM_DB_CONFIG', {
        host: 'db.internal',
        port: 5432,
        username: 'app_user',
        database: 'electronics_shop',
      });
      // Xác nhận rõ ràng: "password" KHÔNG nằm trong bất kỳ lệnh log nào —
      // tránh vô tình in ra bí mật trong log tập trung (CloudWatch/Loki...).
      const loggedArgs = consoleLogSpy.mock.calls.flat();
      expect(JSON.stringify(loggedArgs)).not.toContain(
        'super-secret-khong-duoc-lo',
      );

      consoleLogSpy.mockRestore();
    });
  });
});
