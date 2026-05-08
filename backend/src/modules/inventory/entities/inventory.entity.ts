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

  // FK thực sự tới products
  @ManyToOne(() => Product, (p) => p.inventories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  @Column({ nullable: true })
  variantId!: string;

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