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
import { Product } from './product.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';

@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  label!: string;

  /** SKU duy nhất cho variant này */
  @Column({ unique: true })
  sku!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price!: number;

  /**
   * Specs riêng của variant (override hoặc bổ sung specs của product)
   * VD: { ram: '12GB', storage: '256GB' }
   */
  @Column({ type: 'jsonb', default: {} })
  specs!: Record<string, string>;

  @Column()
  productId!: string;

  @ManyToOne(() => Product, (p) => p.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  /** Mỗi variant có thể có nhiều bản ghi inventory (nếu cần theo kho) */
  @OneToMany(() => Inventory, (inv) => inv.variant)
  inventories!: Inventory[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
