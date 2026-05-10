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
  ApiConflictResponse,
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
  //  Categories — Public
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
          iconUrl: { type: 'string', example: 'https://cdn.example.com/icons/smartphone.png', nullable: true },
          specFields: {
            type: 'array',
            items: { type: 'string' },
            example: ['ram', 'storage', 'chipset'],
            description: 'Danh sách các trường spec đặc trưng của danh mục',
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  getCategories() {
    return this.catalogService.getCategories();
  }

  @Get('categories/:id')
  @ApiOperation({
    summary: 'Lấy chi tiết một danh mục',
    description: 'Trả về thông tin đầy đủ của một danh mục theo UUID. Không yêu cầu đăng nhập.',
  })
  @ApiParam({ name: 'id', description: 'UUID của danh mục', format: 'uuid', example: 'uuid-...' })
  @ApiOkResponse({
    description: 'Chi tiết danh mục',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', example: 'Điện thoại' },
        slug: { type: 'string', example: 'dien-thoai' },
        iconUrl: { type: 'string', nullable: true },
        specFields: { type: 'array', items: { type: 'string' } },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Danh mục không tồn tại' })
  getCategoryById(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.getCategoryById(id);
  }

  // ===========================
  //  Categories — Admin
  // ===========================

  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: '[Admin] Tạo danh mục mới',
    description:
      'Tạo một danh mục sản phẩm mới. Tên và slug phải duy nhất. Slug sẽ được tự động tạo từ tên nếu không cung cấp. Yêu cầu role **admin**.',
  })
  @ApiBody({
    description: 'Thông tin danh mục mới',
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'Laptop', description: 'Tên danh mục (duy nhất trong hệ thống)' },
        slug: { type: 'string', example: 'laptop', description: 'Slug URL-friendly (tự động tạo từ name nếu bỏ trống)' },
        iconUrl: {
          type: 'string',
          example: 'https://cdn.example.com/icons/laptop.png',
          nullable: true,
          description: 'URL icon của danh mục',
        },
        specFields: {
          type: 'array',
          items: { type: 'string' },
          example: ['ram', 'storage', 'cpu', 'screen'],
          description: 'Các trường spec đặc trưng dùng để filter sản phẩm trong danh mục này',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Danh mục đã được tạo thành công',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', example: 'Laptop' },
        slug: { type: 'string', example: 'laptop' },
        iconUrl: { type: 'string', nullable: true },
        specFields: { type: 'array', items: { type: 'string' } },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Dữ liệu không hợp lệ (thiếu name, ...)' })
  @ApiConflictResponse({ description: 'Tên hoặc slug danh mục đã tồn tại' })
  @ApiUnauthorizedResponse({ description: 'Chưa đăng nhập' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  createCategory(@Body() dto: { name: string; slug?: string; iconUrl?: string; specFields?: string[] }) {
    return this.catalogService.createCategory(dto);
  }

  @Patch('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: '[Admin] Cập nhật danh mục',
    description:
      'Cập nhật một phần hoặc toàn bộ thông tin danh mục. Chỉ truyền các trường cần thay đổi. Yêu cầu role **admin**.',
  })
  @ApiParam({ name: 'id', description: 'UUID của danh mục', format: 'uuid', example: 'uuid-...' })
  @ApiBody({
    description: 'Các trường cần cập nhật (đều là optional)',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Laptop Gaming', description: 'Tên mới của danh mục' },
        slug: { type: 'string', example: 'laptop-gaming', description: 'Slug mới' },
        iconUrl: { type: 'string', example: 'https://cdn.example.com/icons/laptop-gaming.png', nullable: true },
        specFields: {
          type: 'array',
          items: { type: 'string' },
          example: ['ram', 'storage', 'gpu', 'cpu'],
          description: 'Danh sách trường spec mới (ghi đè hoàn toàn danh sách cũ)',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Danh mục đã được cập nhật' })
  @ApiNotFoundResponse({ description: 'Danh mục không tồn tại' })
  @ApiConflictResponse({ description: 'Tên hoặc slug đã được sử dụng bởi danh mục khác' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { name?: string; slug?: string; iconUrl?: string; specFields?: string[] },
  ) {
    return this.catalogService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '[Admin] Xóa danh mục',
    description:
      'Xóa vĩnh viễn một danh mục. **Lưu ý:** Không thể xóa danh mục đang có sản phẩm (sẽ trả về lỗi 409). Hãy di chuyển hoặc xóa các sản phẩm trước. Yêu cầu role **admin**.',
  })
  @ApiParam({ name: 'id', description: 'UUID của danh mục', format: 'uuid', example: 'uuid-...' })
  @ApiNoContentResponse({ description: 'Danh mục đã bị xóa thành công' })
  @ApiNotFoundResponse({ description: 'Danh mục không tồn tại' })
  @ApiConflictResponse({ description: 'Không thể xóa: danh mục vẫn đang chứa sản phẩm' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.deleteCategory(id);
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
        items: {
          type: 'array',
          items: { type: 'object', description: 'Product object' },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 120 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            totalPages: { type: 'number', example: 6 },
          },
        },
      },
    },
  })
  findAll(@Query() query: ProductQueryDto) {
    return this.catalogService.findAll(query);
  }

  @Get('products/:slug')
  @ApiOperation({
    summary: 'Lấy chi tiết sản phẩm theo slug',
    description:
      'Trả về đầy đủ thông tin sản phẩm bao gồm danh sách variants, ảnh, thông số kỹ thuật. Mỗi lần gọi sẽ tăng viewCount. Không yêu cầu đăng nhập.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug của sản phẩm (ví dụ: samsung-galaxy-s24-ultra)',
    example: 'samsung-galaxy-s24-ultra',
  })
  @ApiOkResponse({
    description: 'Chi tiết sản phẩm kèm variants',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', example: 'Samsung Galaxy S24 Ultra' },
        slug: { type: 'string', example: 'samsung-galaxy-s24-ultra' },
        brand: { type: 'string', example: 'Samsung' },
        description: { type: 'string', nullable: true },
        price: { type: 'number', example: 29990000 },
        salePrice: { type: 'number', example: 27990000, nullable: true },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              key: { type: 'string' },
            },
          },
        },
        specs: { type: 'object', additionalProperties: { type: 'string' } },
        status: { type: 'string', enum: ['active', 'inactive', 'discontinued'] },
        soldCount: { type: 'number', example: 142 },
        viewCount: { type: 'number', example: 3200 },
        category: { type: 'object' },
        variants: { type: 'array', items: { type: 'object' } },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
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
  @ApiConflictResponse({ description: 'Slug sản phẩm đã tồn tại' })
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
    description:
      'Cập nhật một phần hoặc toàn bộ thông tin sản phẩm. Chỉ truyền các trường cần thay đổi. Ảnh mới sẽ được thêm vào danh sách hiện tại. Nếu truyền `variants`, toàn bộ variants cũ sẽ bị thay thế. Yêu cầu role **admin**.',
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
        specs: { type: 'string', description: 'JSON string của specs object' },
        categoryId: { type: 'string', format: 'uuid' },
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'discontinued'],
          description: 'Trạng thái sản phẩm',
        },
        variants: {
          type: 'string',
          description: 'JSON string mảng variants — **ghi đè hoàn toàn** danh sách variants cũ',
          example: '[{"label":"12GB/256GB","sku":"SKU-002","price":32990000}]',
        },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Ảnh mới (sẽ được thêm vào danh sách ảnh hiện tại)',
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
    description:
      'Xóa vĩnh viễn sản phẩm và toàn bộ variants, ảnh liên quan. **Không thể khôi phục.** Yêu cầu role **admin**.',
  })
  @ApiParam({ name: 'id', description: 'UUID của sản phẩm', format: 'uuid', example: 'uuid-...' })
  @ApiNoContentResponse({ description: 'Sản phẩm đã bị xóa thành công' })
  @ApiNotFoundResponse({ description: 'Sản phẩm không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.delete(id);
  }

  // ===========================
  //  Variants — Public
  // ===========================

  @Get('products/:id/variants')
  @ApiOperation({
    summary: 'Lấy danh sách variants của sản phẩm',
    description:
      'Trả về toàn bộ variants (phiên bản RAM/ROM, màu sắc, ...) của một sản phẩm. Không yêu cầu đăng nhập.',
  })
  @ApiParam({ name: 'id', description: 'UUID của sản phẩm', format: 'uuid', example: 'uuid-...' })
  @ApiOkResponse({
    description: 'Danh sách variants của sản phẩm',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          label: { type: 'string', example: '8GB / 128GB' },
          sku: { type: 'string', example: 'SKU-GALAXY-S24-8-128' },
          price: { type: 'number', example: 27990000 },
          specs: {
            type: 'object',
            additionalProperties: { type: 'string' },
            example: { ram: '8GB', storage: '128GB' },
          },
          productId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Sản phẩm không tồn tại' })
  getVariants(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.getVariants(id);
  }

  @Get('variants/:variantId')
  @ApiOperation({
    summary: 'Lấy chi tiết một variant',
    description: 'Trả về thông tin đầy đủ của một variant cụ thể theo UUID. Không yêu cầu đăng nhập.',
  })
  @ApiParam({ name: 'variantId', description: 'UUID của variant', format: 'uuid', example: 'uuid-...' })
  @ApiOkResponse({
    description: 'Chi tiết variant',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        label: { type: 'string', example: '8GB / 128GB' },
        sku: { type: 'string', example: 'SKU-GALAXY-S24-8-128' },
        price: { type: 'number', example: 27990000 },
        specs: { type: 'object', additionalProperties: { type: 'string' } },
        productId: { type: 'string', format: 'uuid' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Variant không tồn tại' })
  getVariantById(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.catalogService.findVariant(variantId);
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
    description:
      'Thêm một phiên bản mới (RAM/ROM, màu sắc, ...) cho sản phẩm. Mỗi variant có SKU, giá và specs riêng. Yêu cầu role **admin**.',
  })
  @ApiParam({ name: 'id', description: 'UUID của sản phẩm cha', format: 'uuid', example: 'uuid-...' })
  @ApiBody({ type: CreateVariantDto })
  @ApiCreatedResponse({
    description: 'Variant đã được thêm thành công',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        label: { type: 'string', example: '8GB / 128GB' },
        sku: { type: 'string', example: 'SKU-GALAXY-S24-8-128' },
        price: { type: 'number', example: 27990000 },
        specs: { type: 'object', additionalProperties: { type: 'string' } },
        productId: { type: 'string', format: 'uuid' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Sản phẩm không tồn tại' })
  @ApiBadRequestResponse({ description: 'Dữ liệu không hợp lệ' })
  @ApiConflictResponse({ description: 'SKU đã tồn tại trong hệ thống' })
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
    description:
      'Cập nhật thông tin của một variant cụ thể. Chỉ truyền các trường cần thay đổi. Yêu cầu role **admin**.',
  })
  @ApiParam({ name: 'variantId', description: 'UUID của variant', format: 'uuid', example: 'uuid-...' })
  @ApiBody({ type: UpdateVariantDto })
  @ApiOkResponse({ description: 'Variant đã được cập nhật' })
  @ApiNotFoundResponse({ description: 'Variant không tồn tại' })
  @ApiConflictResponse({ description: 'SKU mới đã được sử dụng bởi variant khác' })
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
    description:
      'Xóa một variant khỏi sản phẩm. **Lưu ý:** Không thể xóa variant đang được tham chiếu trong các đơn hàng chưa hoàn thành. Yêu cầu role **admin**.',
  })
  @ApiParam({ name: 'variantId', description: 'UUID của variant', format: 'uuid', example: 'uuid-...' })
  @ApiNoContentResponse({ description: 'Variant đã bị xóa thành công' })
  @ApiNotFoundResponse({ description: 'Variant không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  deleteVariant(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.catalogService.deleteVariant(variantId);
  }
}