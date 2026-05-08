import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';

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

  @Column({ type: 'jsonb', default: [] })
  variants!: {
    id: string;
    label: string;
    specs: Record<string, string>;
    price: number;
    sku: string;
  }[];

  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.ACTIVE })
  status!: ProductStatus;

  @Column({ default: 0 })
  soldCount!: number;

  @Column({ default: 0 })
  viewCount!: number;

  @ManyToOne(() => Category, (c) => c.products, {
    eager: true,
    onDelete: 'RESTRICT', // Không cho xóa category nếu còn product
  })
  @JoinColumn({ name: 'categoryId' })
  category!: Category;

  @Column()
  categoryId!: string;

  // Quan hệ 1-1 với Inventory (mỗi product có 1 bản ghi tồn kho chính)
  @OneToMany(() => Inventory, (inv) => inv.product)
  inventories!: Inventory[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}