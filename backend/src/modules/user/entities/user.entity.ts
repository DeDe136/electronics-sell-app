import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Order } from '../../order/entities/order.entity';
import { CartItem } from '../../cart/entities/cart-item.entity';

export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  @Exclude()
  password!: string;

  @Column()
  fullName!: string;

  @Column({ nullable: true })
  phone!: string;

  @Column({ nullable: true })
  avatarUrl!: string;

  @Column({ nullable: true })
  avatarKey!: string;

  @Column({ type: 'text', nullable: true })
  address!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role!: UserRole;

  @Column({ default: true })
  isActive!: boolean;

  // Quan hệ ngược — không eager load để tránh query nặng
  @OneToMany(() => Order, (order) => order.user)
  orders!: Order[];

  @OneToMany(() => CartItem, (item) => item.user)
  cartItems!: CartItem[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}