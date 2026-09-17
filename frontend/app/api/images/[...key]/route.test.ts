/**
 * Route dùng NextResponse/Response (Web API) và AWS SDK — cần
 * "@jest-environment node" vì jsdom (mặc định của project) không polyfill
 * sẵn các API này.
 * @jest-environment node
 */
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// s3Client trong route.ts được khởi tạo 1 LẦN ở module scope, ngay lúc
// "import { GET } from './route'" chạy — mà theo ngữ nghĩa ES Module, TẤT
// CẢ import trong file này đều được thực thi TRƯỚC mọi câu lệnh thường
// (kể cả các "const" khai báo phía trên chúng về mặt vị trí code). Vì vậy
// factory của jest.mock() KHÔNG được phép tham chiếu bất kỳ biến ngoài nào
// (kể cả biến "mock..." — sẽ dính lỗi "Cannot access before initialization"
// do TDZ), phải tự chứa (self-contained) hoàn toàn bên trong.
//
// Cách lấy lại đúng 1 instance "send" mock mà route.ts đã tạo ra: đọc qua
// "MockedS3Client.mock.results[0].value.send" — vì S3Client (constructor)
// chỉ được gọi ĐÚNG 1 LẦN (lúc route.ts nạp module), nên kết quả gọi lần
// đó luôn nằm ở index 0.
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  };
});

import { GET } from './route';

const MockedS3Client = S3Client as jest.MockedClass<typeof S3Client>;
const mockSend = MockedS3Client.mock.results[0].value.send as jest.Mock;

function buildCtx(keyParts: string[]) {
  return { params: Promise.resolve({ key: keyParts }) };
}

/** Tạo 1 fake S3 GetObject response tối giản, đủ field route dùng tới. */
function buildS3Response(overrides: {
  bytes?: Uint8Array;
  contentType?: string;
}) {
  const { bytes = new Uint8Array([1, 2, 3]), contentType } = overrides;
  return {
    Body: { transformToByteArray: jest.fn().mockResolvedValue(bytes) },
    ContentType: contentType,
  };
}

describe('GET /api/images/[...key]', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, AWS_S3_BUCKET: 'test-bucket' };
    mockSend.mockReset();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('khởi tạo S3Client KHÔNG truyền "credentials" tường minh (để SDK tự lấy qua IRSA)', () => {
    const callArg = MockedS3Client.mock.calls[0][0] as Record<
      string,
      unknown
    >;

    expect('credentials' in callArg).toBe(false);
  });

  it('trả về 500 khi thiếu biến môi trường AWS_S3_BUCKET', async () => {
    delete process.env.AWS_S3_BUCKET;

    const response = await GET(undefined, buildCtx(['products', 'a.png']));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      message: 'AWS_S3_BUCKET chưa được cấu hình cho pod frontend.',
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('trả về 400 khi thiếu key (mảng key rỗng)', async () => {
    const response = await GET(undefined, buildCtx([]));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ message: 'Thiếu key ảnh.' });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('trả về 400 khi không có "ctx" (params undefined) — fallback về key rỗng', async () => {
    const response = await GET(undefined, undefined);

    expect(response.status).toBe(400);
  });

  it('nối nhiều segment của key bằng "/" trước khi gọi S3 (vd ["products", "abc.png"] -> "products/abc.png")', async () => {
    mockSend.mockResolvedValue(buildS3Response({}));

    await GET(undefined, buildCtx(['products', 'abc.png']));

    const commandArg = mockSend.mock.calls[0][0];
    expect(commandArg).toBeInstanceOf(GetObjectCommand);
    expect(commandArg.input).toEqual({
      Bucket: 'test-bucket',
      Key: 'products/abc.png',
    });
  });

  it('trả về 200 với đúng bytes ảnh, Content-Type từ S3 và Cache-Control 1 ngày', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    mockSend.mockResolvedValue(buildS3Response({ bytes, contentType: 'image/png' }));

    const response = await GET(undefined, buildCtx(['avatars', 'me.png']));
    const arrayBuffer = await response.arrayBuffer();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=86400',
    );
    expect(new Uint8Array(arrayBuffer)).toEqual(bytes);
  });

  it('fallback Content-Type về "application/octet-stream" khi S3 không trả ContentType', async () => {
    mockSend.mockResolvedValue(buildS3Response({ contentType: undefined }));

    const response = await GET(undefined, buildCtx(['file']));

    expect(response.headers.get('Content-Type')).toBe(
      'application/octet-stream',
    );
  });

  it('trả về 404 khi S3 trả response nhưng Body rỗng/không đọc được', async () => {
    mockSend.mockResolvedValue({
      Body: { transformToByteArray: jest.fn().mockResolvedValue(undefined) },
      ContentType: 'image/png',
    });

    const response = await GET(undefined, buildCtx(['missing-body']));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ message: 'Không tìm thấy nội dung ảnh.' });
  });

  it('trả về 404 khi S3 không có field "Body" (vd object không tồn tại)', async () => {
    mockSend.mockResolvedValue({ ContentType: 'image/png' });

    const response = await GET(undefined, buildCtx(['no-body-field']));

    expect(response.status).toBe(404);
  });

  it('trả về 404 CHUNG CHUNG khi S3 ném lỗi (vd AccessDenied hoặc NoSuchKey) — không lộ chi tiết lỗi thật cho client', async () => {
    mockSend.mockRejectedValue(new Error('AccessDenied: not authorized'));

    const response = await GET(undefined, buildCtx(['secret.png']));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ message: 'Không lấy được ảnh từ S3.' });
    // Đảm bảo message lỗi AWS thật KHÔNG bị lộ ra response.
    expect(JSON.stringify(body)).not.toContain('AccessDenied');
  });

  it('trả về 404 (không phân biệt 403 vs 404 của AWS) khi key không tồn tại (NoSuchKey)', async () => {
    const notFoundError = Object.assign(new Error('not found'), {
      name: 'NoSuchKey',
    });
    mockSend.mockRejectedValue(notFoundError);

    const response = await GET(undefined, buildCtx(['ghost.png']));

    expect(response.status).toBe(404);
  });
});