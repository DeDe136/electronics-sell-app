import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

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
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Electronics Shop API')
      .setDescription(
        `## API cho hệ thống bán đồ điện tử\n\n` +
        `### Các nhóm API:\n` +
        `- **Auth** — Đăng ký, đăng nhập, nhận JWT token\n` +
        `- **User** — Quản lý thông tin cá nhân, avatar\n` +
        `- **Catalog** — Danh mục, sản phẩm và variants (có endpoint admin)\n` +
        `- **Cart** — Giỏ hàng (yêu cầu JWT)\n` +
        `- **Orders** — Đặt hàng, xem lịch sử (yêu cầu JWT)\n` +
        `- **Payments** — Khởi tạo thanh toán, webhook VNPay (yêu cầu JWT)\n` +
        `- **Inventory** — Quản lý tồn kho (Admin only)\n\n` +
        `### Xác thực:\n` +
        `Đăng nhập tại \`POST /api/v1/auth/login\` để lấy token, sau đó click **Authorize** và nhập token.`
      )
      .setVersion('1.0')
      .addServer('http://localhost:3001', 'Local Development')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Nhập JWT token',
          in: 'header',
        },
        'JWT',
      )
      .addTag('Auth', 'Đăng ký và đăng nhập')
      .addTag('User', 'Quản lý thông tin người dùng')
      .addTag('Catalog', 'Danh mục, sản phẩm và variants')
      .addTag('Cart', 'Giỏ hàng của người dùng')
      .addTag('Orders', 'Đặt hàng và lịch sử đơn hàng')
      .addTag('Payments', 'Thanh toán và webhook VNPay')
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
  console.log(`🚀 Backend running on http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();