import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../../catalog/entities/product.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  orderId!: string;

  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order!: Order;

  @Column()
  productId!: string;

  // Giữ FK để có thể join query sản phẩm hiện tại
  @ManyToOne(() => Product, {
    onDelete: 'SET NULL',
    nullable: true,
    eager: false,
  })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  // Snapshot tại thời điểm đặt hàng — không thay đổi dù product bị sửa/xóa
  @Column()
  productName!: string;

  @Column({ nullable: true })
  productImage!: string;

  @Column({ nullable: true })
  variantLabel!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice!: number;

  @Column()
  quantity!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
