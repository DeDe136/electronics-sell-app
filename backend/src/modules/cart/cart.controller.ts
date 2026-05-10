import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { CartService, AddToCartDto } from './cart.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/roles.decorator';
import { User } from '../user/entities/user.entity';

class UpdateQuantityDto {
  quantity: number;
}

@ApiTags('Cart')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
@ApiUnauthorizedResponse({ description: 'Chưa đăng nhập hoặc token không hợp lệ' })
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy giỏ hàng hiện tại',
    description: 'Trả về toàn bộ sản phẩm trong giỏ hàng của người dùng đang đăng nhập, kèm tổng tiền và số lượng sản phẩm.',
  })
  @ApiOkResponse({
    description: 'Giỏ hàng của người dùng',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              productId: { type: 'string', format: 'uuid' },
              variantId: { type: 'string', format: 'uuid', nullable: true },
              quantity: { type: 'number', example: 2 },
              product: { type: 'object', description: 'Thông tin sản phẩm' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        subtotal: { type: 'number', example: 55980000, description: 'Tổng tiền hàng (VNĐ)' },
        itemCount: { type: 'number', example: 3, description: 'Tổng số sản phẩm trong giỏ' },
      },
    },
  })
  getCart(@CurrentUser() user: User) {
    return this.cartService.getCart(user.id);
  }

  @Post('items')
  @ApiOperation({
    summary: 'Thêm sản phẩm vào giỏ hàng',
    description:
      'Thêm một sản phẩm (có thể kèm variant) vào giỏ hàng. Nếu sản phẩm/variant đã tồn tại trong giỏ, số lượng sẽ được cộng thêm.',
  })
  @ApiBody({
    type: AddToCartDto,
    description: 'Thông tin sản phẩm cần thêm vào giỏ',
    examples: {
      withoutVariant: {
        summary: 'Thêm sản phẩm không có variant',
        value: { productId: 'uuid-product', quantity: 1 },
      },
      withVariant: {
        summary: 'Thêm sản phẩm có variant (ví dụ: 8GB/128GB)',
        value: { productId: 'uuid-product', variantId: 'uuid-variant', quantity: 2 },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Sản phẩm đã được thêm vào giỏ hàng' })
  @ApiBadRequestResponse({ description: 'Quantity phải >= 1, UUID không hợp lệ' })
  addItem(@CurrentUser() user: User, @Body() dto: AddToCartDto) {
    return this.cartService.addItem(user.id, dto);
  }

  @Patch('items/:id')
  @ApiOperation({
    summary: 'Cập nhật số lượng sản phẩm trong giỏ',
    description: 'Thay đổi số lượng của một item trong giỏ hàng. Nếu quantity = 0, item sẽ bị xóa khỏi giỏ.',
  })
  @ApiParam({ name: 'id', description: 'UUID của cart item', format: 'uuid' })
  @ApiBody({
    description: 'Số lượng mới',
    schema: {
      type: 'object',
      required: ['quantity'],
      properties: {
        quantity: { type: 'number', example: 3, description: 'Số lượng mới (0 = xóa khỏi giỏ)' },
      },
    },
  })
  @ApiOkResponse({ description: 'Số lượng đã được cập nhật' })
  @ApiNotFoundResponse({ description: 'Cart item không tồn tại hoặc không thuộc về user này' })
  updateQuantity(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('quantity') quantity: number,
  ) {
    return this.cartService.updateQuantity(user.id, id, quantity);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xóa một sản phẩm khỏi giỏ hàng',
    description: 'Xóa hoàn toàn một item ra khỏi giỏ hàng.',
  })
  @ApiParam({ name: 'id', description: 'UUID của cart item', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Sản phẩm đã được xóa khỏi giỏ hàng' })
  @ApiNotFoundResponse({ description: 'Cart item không tồn tại hoặc không thuộc về user này' })
  removeItem(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.cartService.removeItem(user.id, id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xóa toàn bộ giỏ hàng',
    description: 'Xóa tất cả sản phẩm trong giỏ hàng của người dùng hiện tại.',
  })
  @ApiNoContentResponse({ description: 'Giỏ hàng đã được làm trống' })
  clearCart(@CurrentUser() user: User) {
    return this.cartService.clearCart(user.id);
  }
}