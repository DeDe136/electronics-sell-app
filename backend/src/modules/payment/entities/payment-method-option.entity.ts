import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
//import { Payment } from './payment.entity';

/**
 * Bảng payment_method_options — danh mục các phương thức thanh toán
 * được phép dùng trong hệ thống. Frontend fetch bảng này để render
 * danh sách lựa chọn động thay vì hard-code.
 *
 * Quan hệ: 1 PaymentMethodOption → nhiều Payment (qua cột method
 * trong bảng payments — join theo code <-> method enum).
 *
 * Lưu ý: TypeORM synchronize sẽ tự tạo bảng khi app khởi động
 * (môi trường dev). Môi trường prod cần chạy migration riêng.
 */
@Entity('payment_method_options')
export class PaymentMethodOption {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Mã định danh kỹ thuật — khớp với enum PaymentMethod trong payment.entity.ts
   * (cod | bank_transfer | momo | vnpay)
   */
  @Column({ unique: true, length: 50 })
  code!: string;

  /** Tên hiển thị cho người dùng */
  @Column({ length: 100 })
  name!: string;

  /** Mô tả ngắn hiển thị dưới tên */
  @Column({ length: 255, nullable: true })
  description!: string;

  /** Emoji hoặc tên icon để frontend hiển thị */
  @Column({ length: 20, default: '💳' })
  icon!: string;

  /** Có đang hoạt động không (false = ẩn khỏi checkout) */
  @Column({ default: true })
  isActive!: boolean;

  /** Thứ tự hiển thị (số nhỏ hiển thị trước) */
  @Column({ default: 0 })
  sortOrder!: number;

  /**
   * Metadata tuỳ biến — ví dụ thông tin tài khoản ngân hàng,
   * URL cổng thanh toán, phí bổ sung...
   * { bankName, accountNumber, accountName, note }
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
