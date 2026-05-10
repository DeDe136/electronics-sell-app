import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListBucketsCommand,
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
      const endpoint = this.config.get<string>('storage.minio.endpoint') ?? 'http://localhost:9000';
      this.bucket = this.config.get<string>('storage.minio.bucket') ?? 'electronics-shop';
      this.s3Client = new S3Client({
        endpoint,
        region: 'us-east-1',
        credentials: {
          accessKeyId: this.config.get<string>('storage.minio.accessKey') ?? 'minioadmin',
          secretAccessKey: this.config.get<string>('storage.minio.secretKey') ?? 'minioadmin',
        },
        forcePathStyle: true,
      });
    } else {
      this.bucket = this.config.get<string>('storage.aws.bucket') ?? 'electronics-shop';
      this.s3Client = new S3Client({
        region: this.config.get<string>('storage.aws.region') ?? 'ap-southeast-1',
        credentials: {
          accessKeyId: this.config.get<string>('storage.aws.accessKeyId') ?? '',
          secretAccessKey: this.config.get<string>('storage.aws.secretAccessKey') ?? '',
        },
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
      await this.s3Client.send(
        new HeadBucketCommand({ Bucket: this.bucket }),
      );
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

  private buildPublicUrl(key: string): string {
    if (this.provider === 'minio') {
      const endpoint = this.config.get<string>('storage.minio.endpoint');
      return `${endpoint}/${this.bucket}/${key}`;
    }
    const region = this.config.get<string>('storage.aws.region');
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }
}