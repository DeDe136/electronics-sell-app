/**
 * Seed entrypoint
 * Chạy: npx ts-node src/database/seeds/run-seeds.ts
 *
 * Thứ tự: categories → products → variants → inventory → users → orders → order_items → payments → cart_items
 */

import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

// Load .env từ thư mục backend/
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { Category } from '../../modules/catalog/entities/category.entity';
import { Product } from '../../modules/catalog/entities/product.entity';
import { ProductVariant } from '../../modules/catalog/entities/product-variant.entity';
import { Inventory } from '../../modules/inventory/entities/inventory.entity';
import { User } from '../../modules/user/entities/user.entity';
import { Order } from '../../modules/order/entities/order.entity';
import { OrderItem } from '../../modules/order/entities/order-item.entity';
import { Payment } from '../../modules/payment/entities/payment.entity';
import { CartItem } from '../../modules/cart/entities/cart-item.entity';

import { seedCategories } from './category.seed';
import { seedProducts } from './product.seed';
import { seedVariants } from './variant.seed';
import { seedInventory } from './inventory.seed';
import { seedUsers } from './user.seed';
import { seedOrders } from './order.seed';
import { seedCartItems } from './cart.seed';

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'electronics_shop',
    entities: [Category, Product, ProductVariant, Inventory, User, Order, OrderItem, Payment, CartItem],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  console.log('✅ Kết nối database thành công\n');

  try {
    console.log('🌱 Bắt đầu seed dữ liệu...\n');

    await seedCategories(dataSource);
    await seedProducts(dataSource);
    await seedVariants(dataSource);   // ← thêm: phải chạy trước inventory
    await seedInventory(dataSource);
    await seedUsers(dataSource);
    await seedOrders(dataSource);
    await seedCartItems(dataSource);

    console.log('\n🎉 Seed hoàn tất!');
  } catch (err) {
    console.error('❌ Lỗi trong quá trình seed:', err);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

main();