import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CreateProductDto, CreateVariantDto, UpdateVariantDto } from './dto/create-product.dto';
import { ProductQueryDto, SortOrder } from './dto/product-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // ===========================
  //  Categories
  // ===========================

  @Get('categories')
  @ApiOperation({
    summary: 'Lấy danh sách tất cả danh mục',
    description: 'Trả về toàn bộ danh mục sản phẩm. Không yêu cầu đăng nhập.',
  })
  @ApiOkResponse({
    description: 'Danh sách danh mục',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'uuid-...' },
          name: { type: 'string', example: 'Điện thoại' },
          slug: { type: 'string', example: 'dien-thoai' },
          icon: { type: 'string', example: 'smartphone', nullable: true },
        },
      },
    },
  })
  getCategories() {
    return this.catalogService.getCategories();
  }

  // ===========================
  //  Products — Public
  // ===========================

  @Get('products')
  @ApiOperation({
    summary: 'Danh sách sản phẩm có filter, sort và pagination',
    description:
      'Lấy danh sách sản phẩm với các tùy chọn lọc theo danh mục, thương hiệu, khoảng giá, thông số kỹ thuật; sắp xếp và phân trang. Không yêu cầu đăng nhập.',
  })
  @ApiOkResponse({
    description: 'Danh sách sản phẩm và thông tin phân trang',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'object', description: 'Product object' },
        },
        total: { type: 'number', example: 120 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
        totalPages: { type: 'number', example: 6 },
      },
    },
  })
  findAll(@Query() query: ProductQueryDto) {
    return this.catalogService.findAll(query);
  }

  @Get('products/:slug')
  @ApiOperation({
    summary: 'Lấy chi tiết sản phẩm theo slug',
    description: 'Trả về đầy đủ thông tin sản phẩm bao gồm danh sách variants, ảnh, thông số kỹ thuật. Không yêu cầu đăng nhập.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug của sản phẩm (ví dụ: samsung-galaxy-s24-ultra)',
    example: 'samsung-galaxy-s24-ultra',
  })
  @ApiOkResponse({ description: 'Chi tiết sản phẩm kèm variants' })
  @ApiNotFoundResponse({ description: 'Sản phẩm không tồn tại' })
  findBySlug(@Param('slug') slug: string) {
    return this.catalogService.findBySlug(slug);
  }

  // ===========================
  //  Products — Admin
  // ===========================

  @Post('products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiOperation({
    summary: '[Admin] Tạo sản phẩm mới',
    description:
      'Tạo sản phẩm mới với đầy đủ thông tin, có thể kèm variants và ảnh sản phẩm (tối đa 10 ảnh). Yêu cầu role **admin**.',
  })
  @ApiBody({
    description: 'Thông tin sản phẩm + ảnh (multipart/form-data)',
    schema: {
      type: 'object',
      required: ['name', 'brand', 'price', 'specs', 'categoryId'],
      properties: {
        name: { type: 'string', example: 'Samsung Galaxy S24 Ultra' },
        brand: { type: 'string', example: 'Samsung' },
        description: { type: 'string', example: 'Mô tả sản phẩm...' },
        price: { type: 'number', example: 29990000 },
        salePrice: { type: 'number', example: 27990000, nullable: true },
        specs: {
          type: 'string',
          description: 'JSON string của specs object',
          example: '{"battery":"5000mAh","chipset":"Snapdragon 8 Gen 3"}',
        },
        variants: {
          type: 'string',
          description: 'JSON string của mảng variants',
          example: '[{"label":"8GB/128GB","sku":"SKU-001","price":27990000}]',
        },
        categoryId: { type: 'string', format: 'uuid', example: 'uuid-...' },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Ảnh sản phẩm (tối đa 10 ảnh, JPG/PNG/WebP)',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Sản phẩm đã được tạo thành công' })
  @ApiBadRequestResponse({ description: 'Dữ liệu không hợp lệ' })
  @ApiUnauthorizedResponse({ description: 'Chưa đăng nhập' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  create(
    @Body() dto: CreateProductDto,
    @UploadedFiles() images?: Express.Multer.File[],
  ) {
    return this.catalogService.create(dto, images);
  }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT')
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '[Admin] Cập nhật thông tin sản phẩm',
    description: 'Cập nhật một phần hoặc toàn bộ thông tin sản phẩm. Chỉ truyền các trường cần thay đổi. Yêu cầu role **admin**.',
  })
  @ApiParam({ name: 'id', description: 'UUID của sản phẩm', format: 'uuid', example: 'uuid-...' })
  @ApiBody({
    description: 'Các trường cần cập nhật (đều là optional)',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Samsung Galaxy S24 Ultra (2024)' },
        brand: { type: 'string', example: 'Samsung' },
        description: { type: 'string' },
        price: { type: 'number', example: 28990000 },
        salePrice: { type: 'number', example: 26990000, nullable: true },
        specs: { type: 'string', description: 'JSON string' },
        categoryId: { type: 'string', format: 'uuid' },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Ảnh mới (sẽ thêm vào danh sách ảnh hiện tại)',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Sản phẩm đã được cập nhật' })
  @ApiNotFoundResponse({ description: 'Sản phẩm không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateProductDto>,
    @UploadedFiles() images?: Express.Multer.File[],
  ) {
    return this.catalogService.update(id, dto, images);
  }

  @Delete('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '[Admin] Xóa sản phẩm',
    description: 'Xóa vĩnh viễn sản phẩm và toàn bộ variants, ảnh liên quan. **Không thể khôi phục.** Yêu cầu role **admin**.',
  })
  @ApiParam({ name: 'id', description: 'UUID của sản phẩm', format: 'uuid', example: 'uuid-...' })
  @ApiNoContentResponse({ description: 'Sản phẩm đã bị xóa thành công' })
  @ApiNotFoundResponse({ description: 'Sản phẩm không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.delete(id);
  }

  // ===========================
  //  Variants — Admin
  // ===========================

  @Post('products/:id/variants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: '[Admin] Thêm variant vào sản phẩm',
    description: 'Thêm một phiên bản mới (RAM/ROM, màu sắc, ...) cho sản phẩm. Mỗi variant có SKU, giá và specs riêng. Yêu cầu role **admin**.',
  })
  @ApiParam({ name: 'id', description: 'UUID của sản phẩm cha', format: 'uuid', example: 'uuid-...' })
  @ApiBody({ type: CreateVariantDto })
  @ApiCreatedResponse({ description: 'Variant đã được thêm thành công' })
  @ApiNotFoundResponse({ description: 'Sản phẩm không tồn tại' })
  @ApiBadRequestResponse({ description: 'SKU đã tồn tại hoặc dữ liệu không hợp lệ' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  addVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.catalogService.addVariant(id, dto);
  }

  @Patch('variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: '[Admin] Cập nhật variant',
    description: 'Cập nhật thông tin của một variant cụ thể. Chỉ truyền các trường cần thay đổi. Yêu cầu role **admin**.',
  })
  @ApiParam({ name: 'variantId', description: 'UUID của variant', format: 'uuid', example: 'uuid-...' })
  @ApiBody({ type: UpdateVariantDto })
  @ApiOkResponse({ description: 'Variant đã được cập nhật' })
  @ApiNotFoundResponse({ description: 'Variant không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  updateVariant(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: Partial<CreateVariantDto>,
  ) {
    return this.catalogService.updateVariant(variantId, dto);
  }

  @Delete('variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '[Admin] Xóa variant',
    description: 'Xóa một variant khỏi sản phẩm. Yêu cầu role **admin**.',
  })
  @ApiParam({ name: 'variantId', description: 'UUID của variant', format: 'uuid', example: 'uuid-...' })
  @ApiNoContentResponse({ description: 'Variant đã bị xóa thành công' })
  @ApiNotFoundResponse({ description: 'Variant không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  deleteVariant(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.catalogService.deleteVariant(variantId);
  }
}