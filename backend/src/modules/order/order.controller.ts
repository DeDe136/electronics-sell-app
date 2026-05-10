import {
  Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { OrderService, CreateOrderDto } from './order.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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
    description: 'Địa chỉ giao hàng và ghi chú',
    examples: {
      basic: {
        summary: 'Ví dụ đặt hàng',
        value: {
          shippingAddress: {
            fullName: 'Nguyen Van A',
            phone: '0901234567',
            address: '123 Nguyen Trai',
            ward: 'Phuong 2',
            district: 'Quan 5',
            city: 'Ho Chi Minh',
          },
          note: 'Giao giờ hành chính, gọi trước 30 phút',
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
    description: 'Trả về toàn bộ lịch sử đơn hàng của người dùng đang đăng nhập, sắp xếp theo ngày tạo mới nhất.',
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
          total: { type: 'number', example: 30020000 },
          createdAt: { type: 'string', format: 'date-time' },
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
    description: 'Trả về đầy đủ thông tin đơn hàng bao gồm danh sách sản phẩm, địa chỉ giao hàng và trạng thái thanh toán. Chỉ xem được đơn hàng của chính mình.',
  })
  @ApiParam({ name: 'id', description: 'UUID của đơn hàng', format: 'uuid', example: 'uuid-...' })
  @ApiOkResponse({ description: 'Chi tiết đơn hàng kèm items và thông tin thanh toán' })
  @ApiNotFoundResponse({ description: 'Đơn hàng không tồn tại hoặc không thuộc về user này' })
  getDetail(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.orderService.getOrderDetail(user.id, id);
  }
}