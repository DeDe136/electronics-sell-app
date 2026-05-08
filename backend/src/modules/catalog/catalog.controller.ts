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
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CreateProductDto, CreateVariantDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Lấy danh sách danh mục' })
  getCategories() {
    return this.catalogService.getCategories();
  }

  @Get('products')
  @ApiOperation({ summary: 'Danh sách sản phẩm có filter/sort/pagination' })
  findAll(@Query() query: ProductQueryDto) {
    return this.catalogService.findAll(query);
  }

  @Get('products/:slug')
  @ApiOperation({ summary: 'Chi tiết sản phẩm theo slug (kèm variants)' })
  findBySlug(@Param('slug') slug: string) {
    return this.catalogService.findBySlug(slug);
  }

  @Post('products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiOperation({ summary: '[Admin] Tạo sản phẩm mới (kèm variants)' })
  create(
    @Body() dto: CreateProductDto,
    @UploadedFiles() images?: Express.Multer.File[],
  ) {
    return this.catalogService.create(dto, images);
  }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiOperation({ summary: '[Admin] Cập nhật sản phẩm' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Xóa sản phẩm' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.delete(id);
  }

  // =====================
  //  Variant endpoints
  // =====================

  @Post('products/:id/variants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Thêm variant vào sản phẩm' })
  addVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.catalogService.addVariant(id, dto);
  }

  @Patch('variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Cập nhật variant' })
  updateVariant(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: Partial<CreateVariantDto>,
  ) {
    return this.catalogService.updateVariant(variantId, dto);
  }

  @Delete('variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Xóa variant' })
  deleteVariant(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.catalogService.deleteVariant(variantId);
  }
}