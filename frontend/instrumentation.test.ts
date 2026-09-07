jest.mock('./lib/metrics', () => ({
  getMetrics: jest.fn(),
}));

jest.mock('@vercel/otel', () => ({
  registerOTel: jest.fn(),
}));

jest.mock('./lib/otel-metrics-processor', () => {
  class MockPrometheusMetricsSpanProcessor {}
  return { PrometheusMetricsSpanProcessor: MockPrometheusMetricsSpanProcessor };
});

import { register } from './instrumentation';
import { getMetrics } from './lib/metrics';
import { registerOTel } from '@vercel/otel';
import { PrometheusMetricsSpanProcessor } from './lib/otel-metrics-processor';

const mockedGetMetrics = getMetrics as jest.Mock;
const mockedRegisterOTel = registerOTel as jest.Mock;

describe('instrumentation.ts — register()', () => {
  const ORIGINAL_ENV = process.env.NEXT_RUNTIME;

  afterEach(() => {
    process.env.NEXT_RUNTIME = ORIGINAL_ENV;
    jest.clearAllMocks();
  });

  describe('khi chạy ở Node.js runtime (NEXT_RUNTIME === "nodejs")', () => {
    beforeEach(() => {
      process.env.NEXT_RUNTIME = 'nodejs';
    });

    it('gọi getMetrics() để khởi tạo registry ngay lúc server start', async () => {
      await register();

      expect(mockedGetMetrics).toHaveBeenCalledTimes(1);
    });

    it('gọi registerOTel() với đúng serviceName "frontend"', async () => {
      await register();

      const [config] = mockedRegisterOTel.mock.calls[0];
      expect(config.serviceName).toBe('frontend');
    });

    it('giữ lại "auto" (tính năng auto-instrument mặc định của Next.js) trong spanProcessors', async () => {
      await register();

      const [config] = mockedRegisterOTel.mock.calls[0];
      expect(config.spanProcessors[0]).toBe('auto');
    });

    it('thêm PrometheusMetricsSpanProcessor vào spanProcessors để ghi duration của SSR page', async () => {
      await register();

      const [config] = mockedRegisterOTel.mock.calls[0];
      expect(config.spanProcessors[1]).toBeInstanceOf(
        PrometheusMetricsSpanProcessor,
      );
    });
  });

  describe('khi chạy ở Edge runtime (NEXT_RUNTIME !== "nodejs")', () => {
    beforeEach(() => {
      process.env.NEXT_RUNTIME = 'edge';
    });

    it('KHÔNG gọi getMetrics() — tránh bundle prom-client (dùng API thuần Node) vào Edge Runtime', async () => {
      await register();

      expect(mockedGetMetrics).not.toHaveBeenCalled();
    });

    it('KHÔNG gọi registerOTel() ở Edge Runtime', async () => {
      await register();

      expect(mockedRegisterOTel).not.toHaveBeenCalled();
    });
  });

  describe('khi NEXT_RUNTIME không được set (undefined)', () => {
    beforeEach(() => {
      delete process.env.NEXT_RUNTIME;
    });

    it('KHÔNG khởi tạo metrics/OpenTelemetry (chỉ chạy khi CHÍNH XÁC là "nodejs")', async () => {
      await register();

      expect(mockedGetMetrics).not.toHaveBeenCalled();
      expect(mockedRegisterOTel).not.toHaveBeenCalled();
    });
  });
});