import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { Category } from './entities/category.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductVariant, Category]),
    StorageModule,
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService], // Export cho OrderModule dùng check price
})
export class CatalogModule {}