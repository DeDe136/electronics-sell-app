import {
  Controller, Post, Get, Patch, Delete,
  Body, Param, UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { PaymentService, CreatePaymentDto } from './payment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Payments')
@Controller('payments')
@ApiBearerAuth('JWT')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Khởi tạo thanh toán cho đơn hàng',
    description:
      'Tạo bản ghi thanh toán cho đơn hàng. Với phương thức **COD**, trạng thái sẽ tự động chuyển thành `success`. Với **VNPay/MoMo**, response sẽ kèm `paymentUrl` để redirect người dùng đến cổng thanh toán.',
  })
  @ApiBody({
    description: 'Thông tin thanh toán',
    schema: {
      type: 'object',
      required: ['orderId', 'method', 'amount'],
      properties: {
        orderId: { type: 'string', format: 'uuid', example: 'uuid-order-id', description: 'UUID của đơn hàng' },
        method: {
          type: 'string',
          enum: ['cod', 'bank_transfer', 'momo', 'vnpay'],
          example: 'vnpay',
          description: 'Phương thức thanh toán',
        },
        amount: { type: 'number', example: 30020000, description: 'Số tiền cần thanh toán (VNĐ)' },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Thanh toán đã được khởi tạo',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        orderId: { type: 'string', format: 'uuid' },
        method: { type: 'string', example: 'vnpay' },
        status: { type: 'string', example: 'pending' },
        amount: { type: 'number', example: 30020000 },
        paymentUrl: {
          type: 'string',
          nullable: true,
          example: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...',
          description: 'URL redirect đến cổng thanh toán (chỉ có với VNPay/MoMo)',
        },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Dữ liệu không hợp lệ hoặc đơn hàng đã được thanh toán' })
  @ApiUnauthorizedResponse({ description: 'Chưa đăng nhập' })
  @ApiNotFoundResponse({ description: 'Đơn hàng không tồn tại' })
  initiate(@Body() dto: CreatePaymentDto) {
    return this.paymentService.initiate(dto);
  }

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Lấy lịch sử thanh toán của đơn hàng',
    description: 'Trả về toàn bộ các lần thanh toán của một đơn hàng, sắp xếp theo thời gian mới nhất.',
  })
  @ApiParam({ name: 'orderId', description: 'UUID của đơn hàng', format: 'uuid', example: 'uuid-...' })
  @ApiOkResponse({
    description: 'Danh sách thanh toán của đơn hàng',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          orderId: { type: 'string', format: 'uuid' },
          method: { type: 'string', enum: ['cod', 'bank_transfer', 'momo', 'vnpay'] },
          status: { type: 'string', enum: ['pending', 'success', 'failed', 'refunded'] },
          amount: { type: 'number', example: 30020000 },
          transactionId: { type: 'string', nullable: true, example: 'VNP-TXN-123456' },
          metadata: { type: 'object', nullable: true, description: 'Dữ liệu thô từ cổng thanh toán' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Đơn hàng không tồn tại' })
  @ApiUnauthorizedResponse({ description: 'Chưa đăng nhập' })
  getByOrder(@Param('orderId') orderId: string) {
    return this.paymentService.getByOrder(orderId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Lấy chi tiết một giao dịch thanh toán',
    description: 'Trả về thông tin đầy đủ của một giao dịch thanh toán theo UUID.',
  })
  @ApiParam({ name: 'id', description: 'UUID của giao dịch thanh toán', format: 'uuid', example: 'uuid-...' })
  @ApiOkResponse({
    description: 'Chi tiết giao dịch thanh toán',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        orderId: { type: 'string', format: 'uuid' },
        method: { type: 'string', enum: ['cod', 'bank_transfer', 'momo', 'vnpay'] },
        status: { type: 'string', enum: ['pending', 'success', 'failed', 'refunded'] },
        amount: { type: 'number', example: 30020000 },
        transactionId: { type: 'string', nullable: true },
        metadata: { type: 'object', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Giao dịch không tồn tại' })
  @ApiUnauthorizedResponse({ description: 'Chưa đăng nhập' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.getById(id);
  }

  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: '[Admin] Cập nhật trạng thái giao dịch',
    description:
      'Admin cập nhật thủ công trạng thái của một giao dịch thanh toán. Sử dụng khi cần đối soát hoặc xử lý ngoại lệ (ví dụ: xác nhận chuyển khoản ngân hàng thủ công). Yêu cầu role **admin**.',
  })
  @ApiParam({ name: 'id', description: 'UUID của giao dịch thanh toán', format: 'uuid', example: 'uuid-...' })
  @ApiBody({
    description: 'Trạng thái và thông tin giao dịch mới',
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'success', 'failed', 'refunded'],
          example: 'success',
          description: 'Trạng thái mới của giao dịch',
        },
        transactionId: {
          type: 'string',
          example: 'BANK-TXN-20260510-001',
          description: 'Mã giao dịch từ ngân hàng/cổng thanh toán (tuỳ chọn)',
        },
        note: {
          type: 'string',
          example: 'Đã xác nhận chuyển khoản ngân hàng thủ công',
          description: 'Ghi chú lý do thay đổi trạng thái',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Trạng thái giao dịch đã được cập nhật',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'success' },
        transactionId: { type: 'string', nullable: true },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Trạng thái không hợp lệ' })
  @ApiNotFoundResponse({ description: 'Giao dịch không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  updatePaymentStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string; transactionId?: string; note?: string },
  ) {
    return this.paymentService.updateStatus(id, dto.status, dto.transactionId, dto.note);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '[Admin] Xóa giao dịch thanh toán',
    description:
      'Xóa vĩnh viễn một giao dịch thanh toán. **Chỉ áp dụng cho giao dịch ở trạng thái `failed`.** Không thể xóa giao dịch đã thành công hoặc đang pending. Yêu cầu role **admin**.',
  })
  @ApiParam({ name: 'id', description: 'UUID của giao dịch thanh toán', format: 'uuid', example: 'uuid-...' })
  @ApiNoContentResponse({ description: 'Giao dịch đã bị xóa thành công' })
  @ApiBadRequestResponse({ description: 'Không thể xóa giao dịch không ở trạng thái failed' })
  @ApiNotFoundResponse({ description: 'Giao dịch không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  deletePayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.deletePayment(id);
  }

  @Post('webhook/vnpay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook nhận callback từ VNPay',
    description:
      '⚠️ **Endpoint này dành cho VNPay server gọi vào sau khi xử lý thanh toán — không phải để frontend gọi trực tiếp.** Không yêu cầu JWT. VNPay sẽ POST dữ liệu giao dịch và chữ ký bảo mật vào đây để hệ thống cập nhật trạng thái đơn hàng.',
  })
  @ApiBody({
    description: 'Payload từ VNPay (cấu trúc do VNPay quy định)',
    schema: {
      type: 'object',
      properties: {
        vnp_TmnCode: { type: 'string', example: 'ABCD1234', description: 'Mã merchant' },
        vnp_Amount: { type: 'string', example: '3002000000', description: 'Số tiền * 100' },
        vnp_BankCode: { type: 'string', example: 'NCB', description: 'Mã ngân hàng' },
        vnp_OrderInfo: { type: 'string', example: 'Thanh toan don hang ORD-20260510-AB123' },
        vnp_ResponseCode: { type: 'string', example: '00', description: "'00' = thành công" },
        vnp_TransactionNo: { type: 'string', example: '14257198', description: 'Mã giao dịch VNPay' },
        vnp_SecureHash: { type: 'string', description: 'Chữ ký HMAC-SHA512 để xác thực' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Webhook nhận thành công',
    schema: {
      type: 'object',
      properties: {
        received: { type: 'boolean', example: true },
      },
    },
  })
  vnpayWebhook(@Body() body: any) {
    // TODO: Xác thực chữ ký VNPay, cập nhật trạng thái
    return { received: true };
  }
}