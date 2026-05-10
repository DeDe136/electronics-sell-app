import {
  Controller, Get, Put, Body, Param, UseGuards, Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth('JWT')
@ApiUnauthorizedResponse({ description: 'Chưa đăng nhập hoặc token không hợp lệ' })
@ApiForbiddenResponse({ description: 'Không có quyền admin' })
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get(':productId')
  @ApiOperation({
    summary: '[Admin] Kiểm tra tồn kho sản phẩm',
    description:
      'Lấy số lượng tồn kho khả dụng (quantity - reserved) của sản phẩm hoặc một variant cụ thể. Trả về 0 nếu chưa có bản ghi tồn kho.',
  })
  @ApiParam({ name: 'productId', description: 'UUID của sản phẩm', format: 'uuid', example: 'uuid-...' })
  @ApiQuery({
    name: 'variantId',
    required: false,
    description: 'UUID của variant (để xem tồn kho riêng của từng variant)',
    type: String,
    example: 'uuid-variant-id',
  })
  @ApiOkResponse({
    description: 'Số lượng tồn kho khả dụng',
    schema: {
      type: 'object',
      properties: {
        productId: { type: 'string', format: 'uuid', example: 'uuid-...' },
        variantId: { type: 'string', format: 'uuid', nullable: true },
        sku: { type: 'string', example: 'uuid-product-uuid-variant' },
        quantity: { type: 'number', example: 100, description: 'Tổng số lượng trong kho' },
        reserved: { type: 'number', example: 5, description: 'Số lượng đang được giữ cho đơn hàng chưa giao' },
        available: { type: 'number', example: 95, description: 'Số lượng khả dụng (quantity - reserved)' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Sản phẩm không tồn tại' })
  getStock(
    @Param('productId') productId: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.inventoryService.getStock(productId, variantId);
  }

  @Put(':productId')
  @ApiOperation({
    summary: '[Admin] Cập nhật (ghi đè) số lượng tồn kho',
    description:
      'Đặt số lượng tồn kho cho sản phẩm hoặc một variant. **Ghi đè hoàn toàn** số lượng hiện tại (không cộng thêm). Tạo bản ghi mới nếu chưa tồn tại.',
  })
  @ApiParam({ name: 'productId', description: 'UUID của sản phẩm', format: 'uuid', example: 'uuid-...' })
  @ApiBody({
    description: 'Số lượng cần cập nhật',
    schema: {
      type: 'object',
      required: ['quantity'],
      properties: {
        quantity: {
          type: 'number',
          example: 200,
          description: 'Số lượng tồn kho mới (sẽ ghi đè số cũ)',
        },
        variantId: {
          type: 'string',
          format: 'uuid',
          nullable: true,
          example: 'uuid-variant-id',
          description: 'UUID của variant (bỏ qua nếu cập nhật cho cả sản phẩm)',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Tồn kho đã được cập nhật',
    schema: {
      type: 'object',
      properties: {
        sku: { type: 'string', example: 'uuid-product' },
        productId: { type: 'string', format: 'uuid' },
        variantId: { type: 'string', format: 'uuid', nullable: true },
        quantity: { type: 'number', example: 200 },
        reserved: { type: 'number', example: 5 },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Quantity phải là số nguyên không âm' })
  setStock(
    @Param('productId') productId: string,
    @Body('quantity') quantity: number,
    @Body('variantId') variantId?: string,
  ) {
    return this.inventoryService.setStock(productId, quantity, variantId);
  }
}