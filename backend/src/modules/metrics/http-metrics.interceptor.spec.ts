import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsService } from './metrics.service';

describe('HttpMetricsInterceptor', () => {
  let interceptor: HttpMetricsInterceptor;
  let metricsService: {
    httpRequestDuration: { observe: jest.Mock };
    httpRequestsTotal: { inc: jest.Mock };
  };

  const buildContext = (req: any, res: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    }) as unknown as ExecutionContext;

  const buildCallHandler = (returnValue: any = 'ok'): CallHandler => ({
    handle: jest.fn().mockReturnValue(of(returnValue)),
  });

  beforeEach(() => {
    metricsService = {
      httpRequestDuration: { observe: jest.fn() },
      httpRequestsTotal: { inc: jest.fn() },
    };
    interceptor = new HttpMetricsInterceptor(
      metricsService as unknown as MetricsService,
    );
  });

  it('dùng "req.route.path" (route pattern gốc) khi có, KHÔNG dùng "req.url" — tránh cardinality explosion', (done) => {
    const req = {
      method: 'GET',
      url: '/catalog/products/42',
      route: { path: '/catalog/products/:id' },
    };
    const res = { statusCode: 200 };
    const next = buildCallHandler();

    interceptor.intercept(buildContext(req, res), next).subscribe(() => {
      expect(metricsService.httpRequestDuration.observe).toHaveBeenCalledWith(
        expect.objectContaining({ route: '/catalog/products/:id' }),
        expect.any(Number),
      );
      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledWith(
        expect.objectContaining({ route: '/catalog/products/:id' }),
      );
      done();
    });
  });

  it('fallback về "req.url" khi request không có "route.path" (vd 404, không khớp route nào)', (done) => {
    const req = { method: 'GET', url: '/khong-ton-tai', route: undefined };
    const res = { statusCode: 404 };
    const next = buildCallHandler();

    interceptor.intercept(buildContext(req, res), next).subscribe(() => {
      expect(metricsService.httpRequestDuration.observe).toHaveBeenCalledWith(
        expect.objectContaining({ route: '/khong-ton-tai' }),
        expect.any(Number),
      );
      done();
    });
  });

  it('gắn đúng label "method" và "status_code" (status_code là string) khi ghi nhận metric', (done) => {
    const req = { method: 'POST', url: '/catalog/products', route: undefined };
    const res = { statusCode: 201 };
    const next = buildCallHandler();

    interceptor.intercept(buildContext(req, res), next).subscribe(() => {
      const [labels] = metricsService.httpRequestDuration.observe.mock.calls[0];
      expect(labels).toEqual({
        method: 'POST',
        route: '/catalog/products',
        status_code: '201',
      });
      expect(typeof labels.status_code).toBe('string');
      done();
    });
  });

  it('đo "durationSeconds" là số không âm và gọi observe() + inc() với CÙNG 1 bộ labels', (done) => {
    const req = { method: 'GET', url: '/catalog/products', route: undefined };
    const res = { statusCode: 200 };
    const next = buildCallHandler();

    interceptor.intercept(buildContext(req, res), next).subscribe(() => {
      const [durationLabels, duration] =
        metricsService.httpRequestDuration.observe.mock.calls[0];
      const [counterLabels] =
        metricsService.httpRequestsTotal.inc.mock.calls[0];

      expect(duration).toBeGreaterThanOrEqual(0);
      expect(counterLabels).toEqual(durationLabels);
      done();
    });
  });

  it('chỉ ghi nhận metric SAU KHI request hoàn tất (tap chạy sau next.handle() emit), không ghi trước', (done) => {
    const req = { method: 'GET', url: '/catalog/products', route: undefined };
    const res = { statusCode: 200 };
    const next = buildCallHandler();

    // Trước khi subscribe, next.handle() có thể đã được gọi (do interceptor
    // gọi handle() ngay), nhưng side-effect ghi metric (tap) chỉ chạy khi
    // observable thực sự phát giá trị — nghĩa là chưa gọi observe()/inc()
    // ngay tại thời điểm intercept() return.
    const result = interceptor.intercept(buildContext(req, res), next);
    expect(metricsService.httpRequestDuration.observe).not.toHaveBeenCalled();
    expect(metricsService.httpRequestsTotal.inc).not.toHaveBeenCalled();

    result.subscribe(() => {
      expect(metricsService.httpRequestDuration.observe).toHaveBeenCalledTimes(
        1,
      );
      expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('trả về nguyên vẹn giá trị response mà next.handle() phát ra (không làm thay đổi luồng dữ liệu)', (done) => {
    const req = { method: 'GET', url: '/catalog/products', route: undefined };
    const res = { statusCode: 200 };
    const payload = { items: [{ id: 'p1' }] };
    const next = buildCallHandler(payload);

    interceptor.intercept(buildContext(req, res), next).subscribe((value) => {
      expect(value).toBe(payload);
      done();
    });
  });
});
