import { withMetrics } from './with-metrics';
import { getMetrics } from './metrics';

jest.mock('./metrics', () => ({
  getMetrics: jest.fn(),
}));

const mockedGetMetrics = getMetrics as jest.Mock;

describe('lib/with-metrics.ts — withMetrics()', () => {
  let observeMock: jest.Mock;
  let incMock: jest.Mock;

  beforeEach(() => {
    observeMock = jest.fn();
    incMock = jest.fn();
    mockedGetMetrics.mockReturnValue({
      httpRequestDuration: { observe: observeMock },
      httpRequestsTotal: { inc: incMock },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('trả về nguyên vẹn Response mà handler gốc phát ra', async () => {
    const fakeResponse = { status: 200, body: 'ok' } as unknown as Response;
    const handler = jest.fn().mockResolvedValue(fakeResponse);
    const wrapped = withMetrics('/api/ping', handler);

    const result = await wrapped();

    expect(result).toBe(fakeResponse);
  });

  it('chuyển tiếp đầy đủ "req" và "ctx" cho handler gốc', async () => {
    const handler = jest.fn().mockResolvedValue({ status: 200 });
    const wrapped = withMetrics('/api/ping', handler);
    const fakeReq = { method: 'POST' } as any;
    const fakeCtx = { params: { id: '1' } };

    await wrapped(fakeReq, fakeCtx);

    expect(handler).toHaveBeenCalledWith(fakeReq, fakeCtx);
  });

  it('mặc định method là "GET" khi gọi không có "req" (khớp cách unit test hiện có gọi trực tiếp GET())', async () => {
    const handler = jest.fn().mockResolvedValue({ status: 200 });
    const wrapped = withMetrics('/api/ping', handler);

    await wrapped();

    expect(observeMock).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET' }),
      expect.any(Number),
    );
  });

  it('lấy method từ "req.method" khi có req', async () => {
    const handler = jest.fn().mockResolvedValue({ status: 200 });
    const wrapped = withMetrics('/api/health-check', handler);
    const fakeReq = { method: 'POST' } as any;

    await wrapped(fakeReq);

    expect(observeMock).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST' }),
      expect.any(Number),
    );
  });

  it('gắn đúng "route" là tên route truyền vào withMetrics(), không phải URL thật', async () => {
    const handler = jest.fn().mockResolvedValue({ status: 200 });
    const wrapped = withMetrics('/api/metrics', handler);

    await wrapped();

    expect(observeMock).toHaveBeenCalledWith(
      expect.objectContaining({ route: '/api/metrics' }),
      expect.any(Number),
    );
  });

  it('lấy "status_code" (dạng string) từ response.status khi handler thành công', async () => {
    const handler = jest.fn().mockResolvedValue({ status: 201 });
    const wrapped = withMetrics('/api/ping', handler);

    await wrapped();

    const [labels] = observeMock.mock.calls[0];
    expect(labels.status_code).toBe('201');
  });

  it('ghi status_code = "500" và VẪN throw lại lỗi gốc khi handler ném lỗi', async () => {
    const error = new Error('boom');
    const handler = jest.fn().mockRejectedValue(error);
    const wrapped = withMetrics('/api/ping', handler);

    await expect(wrapped()).rejects.toThrow('boom');

    const [labels] = observeMock.mock.calls[0];
    expect(labels.status_code).toBe('500');
  });

  it('vẫn ghi nhận metric (observe + inc) ngay cả khi handler lỗi — không được bỏ sót request lỗi khỏi thống kê', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    const wrapped = withMetrics('/api/ping', handler);

    await expect(wrapped()).rejects.toThrow();

    expect(observeMock).toHaveBeenCalledTimes(1);
    expect(incMock).toHaveBeenCalledTimes(1);
  });

  it('observe() và inc() được gọi với CÙNG 1 bộ labels', async () => {
    const handler = jest.fn().mockResolvedValue({ status: 200 });
    const wrapped = withMetrics('/api/ping', handler);

    await wrapped();

    const [durationLabels] = observeMock.mock.calls[0];
    const [counterLabels] = incMock.mock.calls[0];
    expect(counterLabels).toEqual(durationLabels);
  });

  it('đo duration là số không âm', async () => {
    const handler = jest.fn().mockResolvedValue({ status: 200 });
    const wrapped = withMetrics('/api/ping', handler);

    await wrapped();

    const [, duration] = observeMock.mock.calls[0];
    expect(duration).toBeGreaterThanOrEqual(0);
  });
});