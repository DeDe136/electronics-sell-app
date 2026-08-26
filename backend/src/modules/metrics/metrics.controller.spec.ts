import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: { registry: { metrics: jest.Mock } };

  beforeEach(() => {
    metricsService = {
      registry: {
        metrics: jest.fn(),
      },
    };

    controller = new MetricsController(
      metricsService as unknown as MetricsService,
    );
  });

  describe('getMetrics', () => {
    it('trả về đúng nội dung do registry.metrics() sinh ra (định dạng Prometheus text)', async () => {
      const prometheusText =
        '# HELP http_requests_total Tổng số HTTP request đã xử lý\n' +
        '# TYPE http_requests_total counter\n' +
        'http_requests_total{method="GET",route="/catalog/products",status_code="200"} 3\n';
      metricsService.registry.metrics.mockResolvedValue(prometheusText);

      const result = await controller.getMetrics();

      expect(metricsService.registry.metrics).toHaveBeenCalledTimes(1);
      expect(result).toBe(prometheusText);
    });

    it('trả về chuỗi rỗng khi registry chưa có metric nào được ghi nhận', async () => {
      metricsService.registry.metrics.mockResolvedValue('');

      const result = await controller.getMetrics();

      expect(result).toBe('');
    });

    it('không nuốt lỗi: reject nếu registry.metrics() ném lỗi', async () => {
      metricsService.registry.metrics.mockRejectedValue(
        new Error('registry error'),
      );

      await expect(controller.getMetrics()).rejects.toThrow('registry error');
    });
  });
});