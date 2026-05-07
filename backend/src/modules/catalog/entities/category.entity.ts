import { Product } from './product.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // vd: 'Smartphone', 'Laptop', 'Tablet'

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  iconUrl: string;

  /**
   * Định nghĩa spec fields cho từng category.
   * Ví dụ Smartphone: ['ram', 'storage', 'battery', 'screen', 'os', 'camera']
   * Ví dụ Laptop: ['ram', 'cpu', 'gpu', 'storage', 'screen', 'battery', 'os', 'weight']
   */
  @Column({ type: 'jsonb', default: [] })
  specFields: string[];

  @OneToMany(() => Product, (p) => p.category)
  products: Product[];

  @CreateDateColumn()
  createdAt: Date;
}
