import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Category } from './category.entity';

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DISCONTINUED = 'discontinued',
}

/**
 * Specs linh hoạt dạng JSONB — hỗ trợ mọi loại đồ điện tử.
 *
 * Smartphone example:
 * {
 *   ram: '8GB', storage: '256GB', battery: '5000mAh',
 *   screen: '6.7" AMOLED 120Hz', os: 'Android 14',
 *   camera: '200MP + 12MP + 10MP', chipset: 'Snapdragon 8 Gen 3',
 *   weight: '228g', color: 'Titanium Black'
 * }
 *
 * Laptop example:
 * {
 *   cpu: 'Intel Core Ultra 7 155H', gpu: 'RTX 4060 8GB',
 *   ram: '32GB DDR5', storage: '1TB NVMe SSD',
 *   screen: '16" 2K 165Hz', battery: '99Wh', weight: '2.1kg',
 *   os: 'Windows 11 Home', ports: 'USB-C x2, USB-A x3, HDMI 2.1'
 * }
 */
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // vd: 'Samsung Galaxy S24 Ultra'

  @Column({ unique: true })
  slug: string;

  @Column()
  brand: string; // vd: 'Samsung', 'Apple', 'Dell'

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  salePrice: number; // Giá khuyến mãi (null = không giảm)

  /**
   * Mảng URL ảnh sản phẩm, ảnh đầu là thumbnail chính.
   * Lưu S3/MinIO keys để quản lý xóa dễ hơn.
   */
  @Column({ type: 'jsonb', default: [] })
  images: { url: string; key: string }[];

  /**
   * Specs kỹ thuật linh hoạt theo từng loại thiết bị.
   * JSONB cho phép query theo specs: WHERE specs->>'ram' = '16GB'
   */
  @Column({ type: 'jsonb', default: {} })
  specs: Record<string, string>;

  /**
   * Variants (biến thể màu sắc, cấu hình).
   * Ví dụ: [{ ram: '8GB', storage: '128GB', color: 'Black', price: 25000000 }]
   */
  @Column({ type: 'jsonb', default: [] })
  variants: {
    id: string;
    label: string;
    specs: Record<string, string>;
    price: number;
    sku: string;
  }[];

  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.ACTIVE })
  status: ProductStatus;

  @Column({ default: 0 })
  soldCount: number; // Đếm số lượng bán được

  @Column({ default: 0 })
  viewCount: number;

  @ManyToOne(() => Category, (c) => c.products, { eager: true })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column()
  categoryId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
