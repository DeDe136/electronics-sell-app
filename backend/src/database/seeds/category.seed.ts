import { DataSource } from 'typeorm';
import { Category } from '../../modules/catalog/entities/category.entity';

export async function seedCategories(dataSource: DataSource) {
  const repo = dataSource.getRepository(Category);

  const categories: Partial<Category>[] = [
    {
      name: 'Điện thoại',
      slug: 'dien-thoai',
      iconUrl: 'http://localhost:9000/electronics-shop/products/icons/phone.svg',
      specFields: ['Màn hình', 'Camera', 'Pin', 'RAM', 'Bộ nhớ', 'Chip xử lý', 'Hệ điều hành'],
    },
    {
      name: 'Laptop',
      slug: 'laptop',
      iconUrl: 'http://localhost:9000/electronics-shop/products/icons/laptop.svg',
      specFields: ['CPU', 'RAM', 'Ổ cứng', 'Màn hình', 'Card đồ họa', 'Pin', 'Hệ điều hành'],
    },
    {
      name: 'Tai nghe',
      slug: 'tai-nghe',
      iconUrl: 'http://localhost:9000/electronics-shop/products/icons/headphone.svg',
      specFields: ['Loại kết nối', 'Driver', 'Chống ồn', 'Pin', 'Tần số đáp ứng'],
    },
    {
      name: 'Đồng hồ thông minh',
      slug: 'dong-ho-thong-minh',
      iconUrl: 'http://localhost:9000/electronics-shop/products/icons/smartwatch.svg',
      specFields: ['Màn hình', 'Pin', 'Chống nước', 'GPS', 'Cảm biến nhịp tim'],
    },
    {
      name: 'Máy tính bảng',
      slug: 'may-tinh-bang',
      iconUrl: 'http://localhost:9000/electronics-shop/products/icons/tablet.svg',
      specFields: ['Màn hình', 'CPU', 'RAM', 'Bộ nhớ', 'Pin', 'Camera', 'Hệ điều hành'],
    },
  ];

  for (const data of categories) {
    const existing = await repo.findOneBy({ slug: data.slug });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(`  [categories] ✔ Inserted: ${data.name}`);
    } else {
      console.log(`  [categories] — Skipped (đã tồn tại): ${data.name}`);
    }
  }
}