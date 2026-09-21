import { isApiImageProxyUrl } from './image';

describe('isApiImageProxyUrl', () => {
  it('trả về true cho URL bắt đầu bằng "/api/images/" (proxy S3 phía backend AWS)', () => {
    expect(isApiImageProxyUrl('/api/images/products/abc-123.png')).toBe(true);
  });

  it('trả về true ngay cả khi chỉ có "/api/images/" mà không có key theo sau', () => {
    expect(isApiImageProxyUrl('/api/images/')).toBe(true);
  });

  it('trả về false cho URL tuyệt đối tới MinIO local (không cần tắt optimize)', () => {
    expect(
      isApiImageProxyUrl('http://minio:9000/electronics-shop/products/abc.png'),
    ).toBe(false);
  });

  it('trả về false cho URL tuyệt đối bất kỳ khác (vd CDN/S3 public)', () => {
    expect(
      isApiImageProxyUrl('https://cdn.example.com/products/abc.png'),
    ).toBe(false);
  });

  it('trả về false cho path nội bộ khác không phải "/api/images/" (vd trùng tiền tố nhưng thiếu dấu "/")', () => {
    expect(isApiImageProxyUrl('/api/images')).toBe(false);
    expect(isApiImageProxyUrl('/api/imagesfoo/x.png')).toBe(false);
  });

  it('trả về false khi url là null, undefined, hoặc chuỗi rỗng', () => {
    expect(isApiImageProxyUrl(null)).toBe(false);
    expect(isApiImageProxyUrl(undefined)).toBe(false);
    expect(isApiImageProxyUrl('')).toBe(false);
  });
});