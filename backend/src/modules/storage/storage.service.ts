import { Injectable, Logger } from '@nestjs/common';
import { inspect } from 'node:util';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
// eslint-disable-next-line @typescript-eslint/no-namespace
type MulterFile = Express.Multer.File;

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly provider: string;

  constructor(private readonly config: ConfigService) {
    this.provider = this.config.get<string>('storage.provider') ?? 'minio';

    if (this.provider === 'minio') {
      const endpoint =
        this.config.get<string>('storage.minio.endpoint') ??
        'http://localhost:9000';
      this.bucket =
        this.config.get<string>('storage.minio.bucket') ?? 'electronics-shop';
      this.s3Client = new S3Client({
        endpoint,
        region: 'us-east-1',
        credentials: {
          accessKeyId:
            this.config.get<string>('storage.minio.accessKey') ?? 'minioadmin',
          secretAccessKey:
            this.config.get<string>('storage.minio.secretKey') ?? 'minioadmin',
        },
        forcePathStyle: true,
      });
    } else {
      this.bucket =
        this.config.get<string>('storage.aws.bucket') ?? 'electronics-shop';
      const accessKeyId = this.config.get<string>('storage.aws.accessKeyId');
      const secretAccessKey = this.config.get<string>(
        'storage.aws.secretAccessKey',
      );
      this.s3Client = new S3Client({
        region:
          this.config.get<string>('storage.aws.region') ?? 'ap-southeast-1',
        // CHỈ truyền "credentials" tĩnh khi có khai báo rõ (vd test local với
        // tài khoản AWS thật). Khi chạy trên EKS với IRSA (không set 2 biến
        // AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY), CỐ Ý không truyền gì cả —
        // AWS SDK sẽ tự lấy credentials tạm thời qua
        // AWS_ROLE_ARN/AWS_WEB_IDENTITY_TOKEN_FILE mà EKS tự tiêm vào pod.
        // Nếu truyền "credentials: { accessKeyId: '', secretAccessKey: '' }"
        // (kể cả rỗng) như trước, SDK sẽ dùng đúng object rỗng đó và KHÔNG
        // rơi về cơ chế tự nhận diện IRSA nữa — mọi request sẽ bị AWS từ
        // chối do thiếu chữ ký hợp lệ.
        ...(accessKeyId && secretAccessKey
          ? { credentials: { accessKeyId, secretAccessKey } }
          : {}),
      });
    }
  }

  /** Gọi tự động khi module khởi tạo */
  async onModuleInit() {
    await this.checkConnection();
  }

  /** Kiểm tra kết nối MinIO / S3 và log kết quả */
  async checkConnection(): Promise<void> {
    const label = this.provider === 'minio' ? 'MinIO' : 'AWS S3';
    try {
      // HeadBucketCommand: nhanh, chỉ kiểm tra bucket tồn tại & quyền truy cập
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      if (this.provider === 'minio') {
        const endpoint = this.config.get<string>('storage.minio.endpoint');
        this.logger.log(
          `✅ MinIO connected — endpoint: ${endpoint}, bucket: "${this.bucket}"`,
        );
      } else {
        const region = this.config.get<string>('storage.aws.region');
        this.logger.log(
          `✅ AWS S3 connected — region: ${region}, bucket: "${this.bucket}"`,
        );
      }
    } catch (err: any) {
      if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
        this.logger.warn(
          `⚠️  ${label} reachable nhưng bucket "${this.bucket}" không tồn tại. Hãy tạo bucket trước khi upload.`,
        );
      } else {
        this.logger.error(
          `❌ Không thể kết nối ${label}: ${err?.message ?? err}`,
        );
        if (err?.cause) {
          this.logger.error(
            `   Nguyên nhân gốc (err.cause): ${JSON.stringify(err.cause, Object.getOwnPropertyNames(err.cause))}`,
          );
        }
        this.logger.error(
          `   Bucket đang dùng: "${this.bucket}", region: "${this.config.get<string>('storage.aws.region')}"`,
        );
        this.logger.error(
          `   Chi tiết đầy đủ: ${inspect(err, { depth: null, showHidden: false })}`,
        );
        this.logger.error(
          `   Bucket đang dùng: "${this.bucket}", region: "${this.config.get<string>('storage.aws.region')}"`,
        );
      }
    }
  }

  /**
   * Upload file buffer lên S3/MinIO
   * @param file - Multer file object
   * @param folder - Thư mục lưu (vd: 'products', 'avatars')
   */
  async uploadFile(
    file: MulterFile,
    folder: string = 'uploads',
  ): Promise<UploadResult> {
    const ext = file.originalname.split('.').pop();
    const key = `${folder}/${uuidv4()}.${ext}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const url = this.buildPublicUrl(key);
    this.logger.log(`Uploaded file: ${key}`);

    return { key, url, bucket: this.bucket };
  }

  /**
   * Upload nhiều ảnh cùng lúc
   */
  async uploadFiles(
    files: MulterFile[],
    folder: string = 'uploads',
  ): Promise<UploadResult[]> {
    return Promise.all(files.map((f) => this.uploadFile(f, folder)));
  }

  /**
   * Xóa file theo key
   */
  async deleteFile(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    this.logger.log(`Deleted file: ${key}`);
  }

  /**
   * Tạo pre-signed URL để client upload trực tiếp (tối ưu performance)
   */
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 300,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Tạo signed URL để truy cập file private
   */
  async getSignedReadUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  buildPublicUrl(key: string): string {
    if (this.provider === 'minio') {
      // KHÔNG đổi gì ở nhánh này — local/docker-compose/k3s vẫn hoạt động
      // y hệt trước giờ (bucket MinIO local đang set anonymous download,
      // xem "mc anonymous set download" trong docker-compose.yml/minio.yaml).
      const endpoint = this.config.get<string>('storage.minio.endpoint');
      return `${endpoint}/${this.bucket}/${key}`;
    }
    // AWS S3: bucket PRIVATE (Block Public Access bật) — trả về đường dẫn
    // proxy nội bộ do route /api/images/[...key] bên FRONTEND tự gọi S3
    // bằng SDK (credentials cấp qua IRSA), browser không bao giờ gọi thẳng
    // S3. Đây là path tương đối (cùng origin với frontend), Next.js Image
    // fetch được luôn mà không cần khai remotePatterns.
    // (Không mã hoá key) — key luôn do chính code sinh ra
    // (uploadFile(): `${folder}/${uuidv4()}.${ext}`, hoặc set tay khi tự
    // upload qua UI MinIO/S3 rồi ghi vào DB/seed), không phải input gõ tay
    // tuỳ ý của người dùng cuối, nên không có khoảng trắng/ký tự đặc biệt
    // cần escape. Trả thẳng key vào path cho dễ đọc/dễ đối chiếu với đúng
    // tên file thật trên S3.
    return `/api/images/${key}`;
  }
}
