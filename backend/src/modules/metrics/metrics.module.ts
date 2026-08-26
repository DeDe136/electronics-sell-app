import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';

// @Global(): MetricsService cần dùng được ở mọi module khác sau này
// (vd sau này muốn tự thêm metric nghiệp vụ như "số đơn hàng tạo thành
// công") mà không phải import MetricsModule lặp lại mỗi nơi.
@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}