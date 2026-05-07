import {
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  IsArray,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
   * Specs linh hoạt:
   * { ram: '12GB', storage: '256GB', battery: '5000mAh', chipset: 'Snapdragon 8 Gen 3' }
   */
  @ApiProperty({
    example: { ram: '12GB', storage: '256GB', battery: '5000mAh' },
  })
  @IsObject()
  specs: Record<string, string>;

  @ApiPropertyOptional({ type: [Object] })
  @IsArray()
  @IsOptional()
  variants?: {
    label: string;
    specs: Record<string, string>;
    price: number;
    sku: string;
  }[];

  @ApiProperty()
  @IsUUID()
  categoryId: string;
}
