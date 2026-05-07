// inventory.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('inventory')
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  sku: string; // productId[-variantId]

  @Column()
  productId: string;

  @Column({ nullable: true })
  variantId: string;

  @Column({ default: 0 })
  quantity: number;

  @Column({ default: 0 })
  reserved: number; // Số lượng đang giữ cho đơn chưa xử lý

  @Column({ default: 5 })
  lowStockThreshold: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
