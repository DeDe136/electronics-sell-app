import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
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
import { OrderService, CreateOrderDto } from './order.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/roles.decorator';
import { User } from '../user/entities/user.entity';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
@ApiUnauthorizedResponse({ description: 'Chưa đăng nhập hoặc token không hợp lệ' })
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({
    summary: 'Đặt hàng từ giỏ hàng hiện tại',
    description:
      'Tạo đơn hàng mới từ toàn bộ sản phẩm trong giỏ hàng. Sau khi đặt hàng thành công, giỏ hàng sẽ tự động được làm trống. Phí vận chuyển cố định 30.000 VNĐ.',
  })
  @ApiBody({
    type: CreateOrderDto,
    description: 'Địa chỉ giao hàng, phương thức thanh toán và ghi chú',
    examples: {
      basic: {
        summary: 'Ví dụ đặt hàng COD',
        value: {
          shippingAddress: {
            fullName: 'Nguyen Van A',
            phone: '0901234567',
            address: '123 Nguyen Trai',
            ward: 'Phuong 2',
            district: 'Quan 5',
            city: 'Ho Chi Minh',
          },
          paymentMethod: 'cod',
          note: 'Giao giờ hành chính, gọi trước 30 phút',
        },
      },
      bank_transfer: {
        summary: 'Ví dụ đặt hàng chuyển khoản',
        value: {
          shippingAddress: {
            fullName: 'Tran Thi B',
            phone: '0912345678',
            address: '456 Le Van Sy',
            ward: 'Phuong 14',
            district: 'Quan 3',
            city: 'Ho Chi Minh',
          },
          paymentMethod: 'bank_transfer',
          note: '',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Đơn hàng đã được tạo thành công',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        orderCode: { type: 'string', example: 'ORD-20260510-AB123' },
        status: { type: 'string', example: 'pending' },
        subtotal: { type: 'number', example: 29990000 },
        shippingFee: { type: 'number', example: 30000 },
        discount: { type: 'number', example: 0 },
        total: { type: 'number', example: 30020000 },
        shippingAddress: { type: 'object' },
        items: { type: 'array' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Giỏ hàng trống hoặc dữ liệu địa chỉ không đầy đủ' })
  create(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    return this.orderService.createFromCart(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách đơn hàng của tôi',
    description:
      'Trả về toàn bộ lịch sử đơn hàng của người dùng đang đăng nhập, sắp xếp theo ngày tạo mới nhất.',
  })
  @ApiOkResponse({
    description: 'Danh sách đơn hàng (không bao gồm chi tiết từng item)',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          orderCode: { type: 'string', example: 'ORD-20260510-AB123' },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled', 'refunded'],
          },
          subtotal: { type: 'number', example: 29990000 },
          shippingFee: { type: 'number', example: 30000 },
          discount: { type: 'number', example: 0 },
          total: { type: 'number', example: 30020000 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  getMyOrders(@CurrentUser() user: User) {
    return this.orderService.getMyOrders(user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lấy chi tiết một đơn hàng',
    description:
      'Trả về đầy đủ thông tin đơn hàng bao gồm danh sách sản phẩm, địa chỉ giao hàng và trạng thái thanh toán. Chỉ xem được đơn hàng của chính mình.',
  })
  @ApiParam({ name: 'id', description: 'UUID của đơn hàng', format: 'uuid', example: 'uuid-...' })
  @ApiOkResponse({
    description: 'Chi tiết đơn hàng kèm items và thông tin thanh toán',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        orderCode: { type: 'string', example: 'ORD-20260510-AB123' },
        status: {
          type: 'string',
          enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled', 'refunded'],
        },
        subtotal: { type: 'number', example: 29990000 },
        shippingFee: { type: 'number', example: 30000 },
        discount: { type: 'number', example: 0 },
        total: { type: 'number', example: 30020000 },
        shippingAddress: {
          type: 'object',
          properties: {
            fullName: { type: 'string' },
            phone: { type: 'string' },
            address: { type: 'string' },
            ward: { type: 'string' },
            district: { type: 'string' },
            city: { type: 'string' },
          },
        },
        note: { type: 'string', nullable: true },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              productId: { type: 'string', format: 'uuid' },
              productName: { type: 'string' },
              productImage: { type: 'string', nullable: true },
              variantLabel: { type: 'string', nullable: true },
              unitPrice: { type: 'number' },
              quantity: { type: 'number' },
              subtotal: { type: 'number' },
            },
          },
        },
        payment: { type: 'object', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Đơn hàng không tồn tại hoặc không thuộc về user này' })
  getDetail(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.orderService.getOrderDetail(user.id, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Hủy đơn hàng',
    description:
      'Người dùng tự hủy đơn hàng của mình. Chỉ có thể hủy khi đơn hàng đang ở trạng thái `pending`. Đơn hàng đã xác nhận hoặc đang giao không thể hủy.',
  })
  @ApiParam({ name: 'id', description: 'UUID của đơn hàng', format: 'uuid', example: 'uuid-...' })
  @ApiOkResponse({
    description: 'Đơn hàng đã được hủy thành công',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'cancelled' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Không thể hủy đơn hàng ở trạng thái hiện tại (chỉ hủy được khi pending)' })
  @ApiNotFoundResponse({ description: 'Đơn hàng không tồn tại hoặc không thuộc về user này' })
  cancelOrder(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.orderService.cancelOrder(user.id, id);
  }

  // ===========================
  //  Admin endpoints
  // ===========================

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: '[Admin] Lấy toàn bộ đơn hàng trong hệ thống',
    description:
      'Admin xem tất cả đơn hàng của mọi người dùng, sắp xếp theo ngày tạo mới nhất. Yêu cầu role **admin**.',
  })
  @ApiOkResponse({
    description: 'Danh sách tất cả đơn hàng',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          orderCode: { type: 'string', example: 'ORD-20260510-AB123' },
          userId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled', 'refunded'] },
          total: { type: 'number', example: 30020000 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  getAllOrders() {
    return this.orderService.getAllOrders();
  }

  @Patch('admin/:id/status')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: '[Admin] Cập nhật trạng thái đơn hàng',
    description:
      'Admin cập nhật trạng thái của bất kỳ đơn hàng nào. Luồng trạng thái thông thường: `pending` → `confirmed` → `shipping` → `delivered`. Admin cũng có thể chuyển sang `cancelled` hoặc `refunded`. Yêu cầu role **admin**.',
  })
  @ApiParam({ name: 'id', description: 'UUID của đơn hàng', format: 'uuid', example: 'uuid-...' })
  @ApiBody({
    description: 'Trạng thái mới của đơn hàng',
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled', 'refunded'],
          example: 'confirmed',
          description: 'Trạng thái mới',
        },
        note: {
          type: 'string',
          example: 'Đã xác nhận đơn hàng, dự kiến giao 2-3 ngày',
          description: 'Ghi chú kèm theo thay đổi trạng thái (tuỳ chọn)',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Trạng thái đơn hàng đã được cập nhật',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        orderCode: { type: 'string', example: 'ORD-20260510-AB123' },
        status: { type: 'string', example: 'confirmed' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Trạng thái không hợp lệ' })
  @ApiNotFoundResponse({ description: 'Đơn hàng không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  updateOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string; note?: string },
  ) {
    return this.orderService.updateOrderStatus(id, dto.status, dto.note);
  }

  @Delete('admin/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '[Admin] Xóa đơn hàng',
    description:
      'Xóa vĩnh viễn một đơn hàng khỏi hệ thống. **Chỉ áp dụng cho đơn hàng đã hủy hoặc đã hoàn tiền.** Đơn hàng đang xử lý không thể xóa. Yêu cầu role **admin**.',
  })
  @ApiParam({ name: 'id', description: 'UUID của đơn hàng', format: 'uuid', example: 'uuid-...' })
  @ApiNoContentResponse({ description: 'Đơn hàng đã bị xóa thành công' })
  @ApiBadRequestResponse({ description: 'Không thể xóa đơn hàng đang trong quá trình xử lý' })
  @ApiNotFoundResponse({ description: 'Đơn hàng không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  deleteOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.orderService.deleteOrder(id);
  }
}