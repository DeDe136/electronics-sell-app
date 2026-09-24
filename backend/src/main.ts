import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  //
  // Global prefix
  //
  // Loại riêng "metrics" ra khỏi prefix "api/v1" — Prometheus mặc định
  // scrape đúng path "/metrics" (convention chuẩn của toàn bộ ecosystem:
  // node-exporter, kube-state-metrics, hầu hết client library đều theo
  // path này), để nếu sau lỡ đổi API prefix (vd "api/v2"), không cần sửa
  // lại ServiceMonitor/scrape config đang trỏ cứng vào "/metrics".
  app.setGlobalPrefix('api/v1', { exclude: ['metrics'] });

  // CORS — cho phép frontend dev
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger docs
  //
  // Trước đây điều kiện này chỉ dựa vào NODE_ENV !== 'production', nhưng
  // NODE_ENV=production lại là giá trị NÊN dùng cho container (giúp
  // Express/NestJS tối ưu hiệu năng), kể cả khi đây chỉ là môi trường
  // local/staging chạy bằng Docker Compose (không phải deploy thật lên
  // production cho người dùng cuối) — dẫn tới Swagger bị tắt "oan" dù ta
  // vẫn muốn xem tài liệu API lúc test bằng Docker.
  //
  // Giải pháp: tách riêng biến ENABLE_SWAGGER, không còn gắn chặt với
  // NODE_ENV. Mặc định (không set biến gì) vẫn giữ hành vi an toàn cũ:
  // chỉ bật khi NODE_ENV !== 'production' — để nếu ai deploy thật lên môi
  // trường production công khai mà quên set biến, Swagger vẫn tắt như
  // trước, không lộ tài liệu API ra ngoài ý muốn.
  const swaggerEnabled =
    process.env.ENABLE_SWAGGER === 'true' ||
    process.env.NODE_ENV !== 'production';

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Electronics Shop API')
      .setDescription(
        `## API cho hệ thống bán đồ điện tử\n\n` +
          `### Các nhóm API:\n` +
          `- **Auth** — Đăng ký, đăng nhập, nhận JWT token\n` +
          `- **User** — Quản lý thông tin cá nhân, avatar; Admin quản lý toàn bộ users\n` +
          `- **Catalog** — Danh mục (CRUD), sản phẩm (CRUD) và variants (CRUD + danh sách)\n` +
          `- **Cart** — Giỏ hàng (yêu cầu JWT)\n` +
          `- **Orders** — Đặt hàng, xem lịch sử, hủy đơn; Admin quản lý trạng thái và xóa đơn\n` +
          `- **Payments** — Khởi tạo thanh toán, webhook VNPay; Admin cập nhật trạng thái và xóa giao dịch\n` +
          `- **Inventory** — Quản lý tồn kho (Admin only)\n\n` +
          `### Xác thực:\n` +
          `Đăng nhập tại \`POST /api/v1/auth/login\` để lấy token, sau đó click **Authorize** và nhập token.\n\n` +
          `### Phân quyền:\n` +
          `- **Public**: Không cần JWT\n` +
          `- **JWT**: Cần đăng nhập (role customer hoặc admin)\n` +
          `- **Admin**: Cần JWT + role \`admin\`\n\n` +
          `### Quy ước endpoint Admin:\n` +
          `Các endpoint dành riêng cho admin được đánh dấu **[Admin]** trong summary và đều yêu cầu role \`admin\`.`,
      )
      .setVersion('1.0')
      .addServer('http://localhost:3001', 'Local Development')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Nhập JWT token (lấy từ POST /auth/login)',
          in: 'header',
        },
        'JWT',
      )
      .addTag('Auth', 'Đăng ký và đăng nhập')
      .addTag('User', 'Quản lý thông tin người dùng (cá nhân + Admin)')
      .addTag('Catalog', 'Danh mục, sản phẩm và variants (Public + Admin CRUD)')
      .addTag('Cart', 'Giỏ hàng của người dùng')
      .addTag('Orders', 'Đặt hàng, lịch sử và quản lý đơn hàng')
      .addTag('Payments', 'Thanh toán, webhook VNPay và quản lý giao dịch')
      .addTag('Inventory', 'Quản lý tồn kho (Admin only)')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'method',
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
      },
      customSiteTitle: 'Electronics Shop API Docs',
    });
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`🚀 Backend running on http://localhost:${port}`);
  logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);

  // ── Kiểm tra kết nối PostgreSQL ──────────────────────────────────
  try {
    const dataSource = app.get(DataSource);
    if (dataSource.isInitialized) {
      const dbOptions = dataSource.options as any;
      logger.log(
        `✅ PostgreSQL connected — host: ${dbOptions.host}:${dbOptions.port}, database: "${dbOptions.database}"`,
      );
    } else {
      logger.warn('⚠️  PostgreSQL DataSource chưa được khởi tạo');
    }
  } catch (err) {
    logger.error(`❌ Không thể kết nối PostgreSQL: ${(err as Error).message}`);
  }

  // (MinIO / S3 được kiểm tra tự động trong StorageService.onModuleInit)
}
bootstrap();
