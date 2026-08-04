import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { OrderItem } from './order-item.entity';
import { Payment } from '../../payment/entities/payment.entity';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  SHIPPING = 'shipping',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  orderCode!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => User, (u) => u.orders, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @OneToMany(() => OrderItem, (item) => item.order, {
    cascade: true,
    eager: true,
  })
  items!: OrderItem[];

  // Quan hệ 1-1: mỗi order có 1 payment
  @OneToOne(() => Payment, (p) => p.order, { cascade: true })
  payment!: Payment;

  @Column({ type: 'jsonb' })
  shippingAddress!: {
    fullName: string;
    phone: string;
    address: string;
    ward: string;
    district: string;
    city: string;
  };

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  shippingFee!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total!: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  @Column({ nullable: true })
  note!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
