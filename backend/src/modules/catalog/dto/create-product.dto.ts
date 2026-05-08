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
  @ApiProperty({ example: '8GB / 128GB' })
  @IsString()
  label: string;

  @ApiProperty({ example: 'SKU-GALAXY-S24-8-128' })
  @IsString()
  sku: string;

  @ApiProperty({ example: 27990000 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  /**
   * Specs riêng của variant (override hoặc bổ sung specs của product)
   * VD: { ram: '8GB', storage: '128GB' }
   */
  @ApiPropertyOptional({ example: { ram: '8GB', storage: '128GB' } })
  @IsObject()
  @IsOptional()
  specs?: Record<string, string>;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Samsung Galaxy S24 Ultra' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Samsung' })
  @IsString()
  brand: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 29990000 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({ example: 27990000 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  salePrice?: number;

  /**
   * Specs chung của sản phẩm:
   * { battery: '5000mAh', chipset: 'Snapdragon 8 Gen 3' }
   */
  @ApiProperty({
    example: { battery: '5000mAh', chipset: 'Snapdragon 8 Gen 3' },
  })
  @IsObject()
  specs: Record<string, string>;

  @ApiPropertyOptional({ type: [CreateVariantDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];

  @ApiProperty()
  @IsUUID()
  categoryId: string;
}