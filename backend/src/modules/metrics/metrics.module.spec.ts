import {
  MODULE_METADATA,
  GLOBAL_MODULE_METADATA,
} from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsModule } from './metrics.module';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';

/**
 * MetricsModule bản thân nó không có logic nghiệp vụ (chỉ khai báo wiring
 * qua @Module/@Global), nhưng vẫn cần test để đảm bảo:
 *   - Module biên dịch được (không thiếu provider/import nào).
 *   - MetricsService thực sự được export ra ngoài (để module khác dùng
 *     được, đúng lý do @Global() ghi trong comment).
 *   - HttpMetricsInterceptor được khai báo làm APP_INTERCEPTOR toàn cục
 *     (thay vì phải tự gắn @UseInterceptors() thủ công ở từng controller).
 *
 * Lưu ý: KHÔNG test việc lấy provider APP_INTERCEPTOR qua
 * TestingModule.get() — đây là 1 token đặc biệt được NestJS core xử lý
 * ở bước bootstrap ứng dụng thật (NestFactory.create), không phải một
 * provider có thể resolve bình thường qua DI container khi chỉ compile
 * TestingModule đơn lẻ. Vì vậy test đọc thẳng metadata mà @Module() gắn
 * lên class — vừa chính xác, vừa không phụ thuộc hành vi nội bộ của Nest.
 */
describe('MetricsModule', () => {
  it('biên dịch được module và cung cấp MetricsService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MetricsModule],
    }).compile();

    const service = moduleRef.get(MetricsService);
    expect(service).toBeInstanceOf(MetricsService);
  });

  it('đăng ký MetricsController để expose route GET /metrics', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MetricsModule],
    }).compile();

    const controller = moduleRef.get(MetricsController);
    expect(controller).toBeInstanceOf(MetricsController);
  });

  it('export MetricsService — module khác import MetricsModule (hoặc dùng @Global) đều lấy được cùng 1 instance', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MetricsModule],
    }).compile();

    const service1 = moduleRef.get(MetricsService);
    const service2 = moduleRef.get(MetricsService);

    expect(service1).toBe(service2);
  });

  it('khai báo @Global() để MetricsService dùng được ở mọi module khác mà không cần import lặp lại', () => {
    const isGlobal = Reflect.getMetadata(GLOBAL_MODULE_METADATA, MetricsModule);

    expect(isGlobal).toBe(true);
  });

  it('khai báo đúng metadata @Module: controllers, exports và provider APP_INTERCEPTOR', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      MetricsModule,
    );
    const exportedProviders = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      MetricsModule,
    );
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      MetricsModule,
    );

    expect(controllers).toEqual([MetricsController]);
    expect(exportedProviders).toEqual([MetricsService]);
    expect(providers).toEqual(
      expect.arrayContaining([
        MetricsService,
        { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
      ]),
    );
  });
});
