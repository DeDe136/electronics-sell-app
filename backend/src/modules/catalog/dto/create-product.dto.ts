import {
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  IsArray,
  Min,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVariantDto {
  @ApiProperty({
    example: '8GB / 128GB',
    description: 'Nhãn hiển thị của variant (ví dụ: dung lượng RAM/ROM)',
  })
  @IsString()
  label: string;

  @ApiProperty({
    example: 'SKU-GALAXY-S24-8-128',
    description: 'Mã SKU duy nhất cho variant này',
  })
  @IsString()
  sku: string;

  @ApiProperty({
    example: 27990000,
    description: 'Giá bán của variant (VNĐ)',
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({
    example: { ram: '8GB', storage: '128GB' },
    description:
      'Thông số kỹ thuật riêng của variant (override hoặc bổ sung specs của sản phẩm)',
  })
  @IsObject()
  @IsOptional()
  specs?: Record<string, string>;
}

export class UpdateVariantDto {
  @ApiPropertyOptional({
    example: '12GB / 256GB',
    description: 'Nhãn hiển thị mới của variant',
  })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({
    example: 'SKU-GALAXY-S24-12-256',
    description: 'Mã SKU mới',
  })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({ example: 32990000, description: 'Giá bán mới (VNĐ)' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  price?: number;

  @ApiPropertyOptional({
    example: { ram: '12GB', storage: '256GB' },
    description: 'Thông số kỹ thuật mới',
  })
  @IsObject()
  @IsOptional()
  specs?: Record<string, string>;
}

export class CreateProductDto {
  @ApiProperty({
    example: 'Samsung Galaxy S24 Ultra',
    description: 'Tên sản phẩm (slug sẽ được tự động tạo từ tên)',
  })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Samsung', description: 'Thương hiệu' })
  @IsString()
  brand: string;

  @ApiPropertyOptional({
    example:
      'Flagship cao cấp nhất của Samsung năm 2024 với chip Snapdragon 8 Gen 3.',
    description: 'Mô tả chi tiết sản phẩm (hỗ trợ HTML)',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 29990000, description: 'Giá gốc (VNĐ)' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({
    example: 27990000,
    description: 'Giá khuyến mãi (VNĐ) — nếu có sẽ hiển thị thay cho giá gốc',
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  salePrice?: number;

  @ApiProperty({
    example: {
      battery: '5000mAh',
      chipset: 'Snapdragon 8 Gen 3',
      screen: '6.8 inch Dynamic AMOLED 2X',
    },
    description: 'Thông số kỹ thuật chung của sản phẩm (key-value)',
  })
  @IsObject()
  specs: Record<string, string>;

  @ApiPropertyOptional({
    type: [CreateVariantDto],
    description:
      'Danh sách các phiên bản (RAM/ROM) của sản phẩm. Mỗi variant có giá và SKU riêng.',
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];

  @ApiProperty({
    example: 'uuid-category-id',
    description: 'ID danh mục (UUID) mà sản phẩm thuộc về',
  })
  @IsUUID()
  categoryId: string;
}
