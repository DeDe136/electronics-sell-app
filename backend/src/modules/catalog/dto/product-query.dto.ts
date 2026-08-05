import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SortOrder {
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NEWEST = 'newest',
  POPULAR = 'popular',
}

export class ProductQueryDto {
  @ApiPropertyOptional({
    example: 'Galaxy S24',
    description:
      'Tìm kiếm theo tên sản phẩm hoặc thương hiệu (full-text search)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'uuid-category-id',
    description: 'Lọc theo ID danh mục',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'Samsung',
    description: 'Lọc theo thương hiệu (phân biệt hoa/thường)',
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({
    example: 5000000,
    description: 'Giá tối thiểu (VNĐ)',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional({
    example: 50000000,
    description: 'Giá tối đa (VNĐ)',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxPrice?: number;

  @ApiPropertyOptional({
    example: { ram: '8GB', storage: '128GB' },
    description:
      'Lọc theo thông số kỹ thuật. Ví dụ: `?specs[ram]=8GB&specs[storage]=256GB`',
  })
  @IsOptional()
  specs?: Record<string, string>;

  @ApiPropertyOptional({
    enum: SortOrder,
    default: SortOrder.NEWEST,
    description:
      'Thứ tự sắp xếp: `price_asc` | `price_desc` | `newest` | `popular`',
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sort?: SortOrder = SortOrder.NEWEST;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Trang hiện tại (bắt đầu từ 1)',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Số sản phẩm mỗi trang (tối đa 50)',
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 20;
}
