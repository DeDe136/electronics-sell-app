import type { ReadableSpan } from '@opentelemetry/sdk-trace-node';
import { PrometheusMetricsSpanProcessor } from './otel-metrics-processor';
import { getMetrics } from './metrics';

jest.mock('./metrics', () => ({
  getMetrics: jest.fn(),
}));

const mockedGetMetrics = getMetrics as jest.Mock;

/** Tạo 1 fake ReadableSpan tối giản, chỉ khai báo field mà onEnd() dùng tới. */
function buildSpan(overrides: {
  isRootSpan?: boolean;
  attributes?: Record<string, unknown>;
  name?: string;
  duration?: [number, number];
}): ReadableSpan {
  const { isRootSpan = true, attributes = {}, name = 'GET /', duration = [0, 0] } =
    overrides;

  return {
    parentSpanContext: isRootSpan ? undefined : { spanId: 'parent-span-id' },
    attributes,
    name,
    duration,
  } as unknown as ReadableSpan;
}

describe('lib/otel-metrics-processor.ts — PrometheusMetricsSpanProcessor', () => {
  let observeMock: jest.Mock;
  let incMock: jest.Mock;
  let processor: PrometheusMetricsSpanProcessor;

  beforeEach(() => {
    observeMock = jest.fn();
    incMock = jest.fn();
    mockedGetMetrics.mockReturnValue({
      httpRequestDuration: { observe: observeMock },
      httpRequestsTotal: { inc: incMock },
    });
    processor = new PrometheusMetricsSpanProcessor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onEnd — lọc span con', () => {
    it('BỎ QUA span con (có parentSpanContext.spanId) — không ghi metric', () => {
      const childSpan = buildSpan({ isRootSpan: false });

      processor.onEnd(childSpan);

      expect(observeMock).not.toHaveBeenCalled();
      expect(incMock).not.toHaveBeenCalled();
    });

    it('XỬ LÝ span gốc (parentSpanContext rỗng) — có ghi metric', () => {
      const rootSpan = buildSpan({
        isRootSpan: true,
        attributes: { 'next.route': '/products/[slug]' },
      });

      processor.onEnd(rootSpan);

      expect(observeMock).toHaveBeenCalledTimes(1);
      expect(incMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('onEnd — xác định "route"', () => {
    it('ưu tiên "next.route" trước "http.route" và span.name', () => {
      const span = buildSpan({
        attributes: {
          'next.route': '/products/[slug]',
          'http.route': '/should-not-use-this',
        },
        name: 'should-not-use-this-either',
      });

      processor.onEnd(span);

      const [labels] = observeMock.mock.calls[0];
      expect(labels.route).toBe('/products/[slug]');
    });

    it('fallback về "http.route" khi thiếu "next.route"', () => {
      const span = buildSpan({
        attributes: { 'http.route': '/checkout/[step]' },
      });

      processor.onEnd(span);

      const [labels] = observeMock.mock.calls[0];
      expect(labels.route).toBe('/checkout/[step]');
    });

    it('fallback về "span.name" khi thiếu cả "next.route" lẫn "http.route"', () => {
      const span = buildSpan({ attributes: {}, name: 'GET /about' });

      processor.onEnd(span);

      const [labels] = observeMock.mock.calls[0];
      expect(labels.route).toBe('GET /about');
    });

    it('chuẩn hoá dấu "\\" (Windows path) thành "/" trong route', () => {
      const span = buildSpan({
        attributes: { 'next.route': '\\products\\[slug]' },
      });

      processor.onEnd(span);

      const [labels] = observeMock.mock.calls[0];
      expect(labels.route).toBe('/products/[slug]');
    });
  });

  describe('onEnd — loại trừ route "/api/*" để tránh đếm trùng với withMetrics', () => {
    it('KHÔNG ghi metric khi route (sau chuẩn hoá) bắt đầu bằng "/api/"', () => {
      const span = buildSpan({
        attributes: { 'next.route': '/api/health-check' },
      });

      processor.onEnd(span);

      expect(observeMock).not.toHaveBeenCalled();
      expect(incMock).not.toHaveBeenCalled();
    });

    it('vẫn loại trừ đúng khi route gốc dùng "\\" kiểu Windows (phải chuẩn hoá TRƯỚC khi kiểm tra "/api/")', () => {
      const span = buildSpan({
        attributes: { 'next.route': '\\api\\metrics' },
      });

      processor.onEnd(span);

      expect(observeMock).not.toHaveBeenCalled();
    });

    it('VẪN ghi metric cho route trang SSR bình thường (không bắt đầu bằng "/api/")', () => {
      const span = buildSpan({
        attributes: { 'next.route': '/products/[slug]' },
      });

      processor.onEnd(span);

      expect(observeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('onEnd — xác định "method" và "status_code"', () => {
    it('lấy method từ "http.method"', () => {
      const span = buildSpan({
        attributes: { 'next.route': '/', 'http.method': 'POST' },
      });

      processor.onEnd(span);

      const [labels] = observeMock.mock.calls[0];
      expect(labels.method).toBe('POST');
    });

    it('fallback method từ từ đầu tiên của "span.name" khi thiếu "http.method"', () => {
      const span = buildSpan({
        attributes: { 'next.route': '/' },
        name: 'PATCH /',
      });

      processor.onEnd(span);

      const [labels] = observeMock.mock.calls[0];
      expect(labels.method).toBe('PATCH');
    });

    it('fallback method về "GET" khi không xác định được từ đâu', () => {
      const span = buildSpan({ attributes: { 'next.route': '/' }, name: '' });

      processor.onEnd(span);

      const [labels] = observeMock.mock.calls[0];
      expect(labels.method).toBe('GET');
    });

    it('lấy status_code từ "http.status_code"', () => {
      const span = buildSpan({
        attributes: { 'next.route': '/', 'http.status_code': 404 },
      });

      processor.onEnd(span);

      const [labels] = observeMock.mock.calls[0];
      expect(labels.status_code).toBe('404');
    });

    it('fallback status_code từ "http.response.status_code" khi thiếu "http.status_code"', () => {
      const span = buildSpan({
        attributes: { 'next.route': '/', 'http.response.status_code': 500 },
      });

      processor.onEnd(span);

      const [labels] = observeMock.mock.calls[0];
      expect(labels.status_code).toBe('500');
    });

    it('fallback status_code về 200 khi không có attribute status nào', () => {
      const span = buildSpan({ attributes: { 'next.route': '/' } });

      processor.onEnd(span);

      const [labels] = observeMock.mock.calls[0];
      expect(labels.status_code).toBe('200');
    });
  });

  describe('onEnd — tính duration và ghi metric', () => {
    it('tính đúng duration (giây) từ tuple [seconds, nanoseconds] của span.duration', () => {
      const span = buildSpan({
        attributes: { 'next.route': '/' },
        duration: [1, 500_000_000], // 1.5 giây
      });

      processor.onEnd(span);

      const [, duration] = observeMock.mock.calls[0];
      expect(duration).toBeCloseTo(1.5, 5);
    });

    it('observe() và inc() dùng CHUNG 1 bộ labels', () => {
      const span = buildSpan({
        attributes: { 'next.route': '/', 'http.method': 'GET' },
      });

      processor.onEnd(span);

      const [durationLabels] = observeMock.mock.calls[0];
      const [counterLabels] = incMock.mock.calls[0];
      expect(counterLabels).toEqual(durationLabels);
    });
  });

  describe('onStart / shutdown / forceFlush', () => {
    it('onStart() không làm gì và không throw', () => {
      expect(() => processor.onStart()).not.toThrow();
    });

    it('shutdown() resolve thành công', async () => {
      await expect(processor.shutdown()).resolves.toBeUndefined();
    });

    it('forceFlush() resolve thành công', async () => {
      await expect(processor.forceFlush()).resolves.toBeUndefined();
    });
  });
});