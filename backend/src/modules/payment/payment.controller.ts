// payment.controller.ts
import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService, CreatePaymentDto } from './payment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  initiate(@Body() dto: CreatePaymentDto) {
    return this.paymentService.initiate(dto);
  }

  @Get('order/:orderId')
  getByOrder(@Param('orderId') orderId: string) {
    return this.paymentService.getByOrder(orderId);
  }

  // Webhook từ cổng thanh toán gọi vào — không cần JWT
  @Post('webhook/vnpay')
  vnpayWebhook(@Body() body: any) {
    // TODO: Xác thực chữ ký VNPay, cập nhật trạng thái
    return { received: true };
  }
}
