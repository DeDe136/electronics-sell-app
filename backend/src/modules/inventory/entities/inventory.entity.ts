import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from '../../catalog/entities/product.entity';
import { ProductVariant } from '../../catalog/entities/product-variant.entity';

@Entity('inventory')
// Index tổng hợp để query theo productId + variantId nhanh hơn
@Index(['productId', 'variantId'], { unique: true })
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  sku!: string;

  @Column()
  productId!: string;

  @ManyToOne(() => Product, (p) => p.inventories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  /** FK thực sự tới bảng product_variants (null = sản phẩm không có variant) */
  @Column({ nullable: true })
  variantId!: string;

  @ManyToOne(() => ProductVariant, (v) => v.inventories, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'variantId' })
  variant!: ProductVariant;

  @Column({ default: 0 })
  quantity!: number;

  @Column({ default: 0 })
  reserved!: number;

  @Column({ default: 5 })
  lowStockThreshold!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
