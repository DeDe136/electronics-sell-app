import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { ProductVariant } from './product-variant.entity';

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DISCONTINUED = 'discontinued',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  slug!: string;

  @Column()
  brand!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  salePrice!: number;

  @Column({ type: 'jsonb', default: [] })
  images!: { url: string; key: string }[];

  @Column({ type: 'jsonb', default: {} })
  specs!: Record<string, string>;

  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.ACTIVE })
  status!: ProductStatus;

  @Column({ default: 0 })
  soldCount!: number;

  @Column({ default: 0 })
  viewCount!: number;

  @ManyToOne(() => Category, (c) => c.products, {
    eager: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'categoryId' })
  category!: Category;

  @Column()
  categoryId!: string;

  /** Variants tách thành bảng riêng — eager load cùng product */
  @OneToMany(() => ProductVariant, (v) => v.product, {
    cascade: true,
    eager: true,
  })
  variants!: ProductVariant[];

  /** Inventory cho sản phẩm không có variant (variantId = null) */
  @OneToMany(() => Inventory, (inv) => inv.product)
  inventories!: Inventory[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
