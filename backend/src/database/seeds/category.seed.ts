import { DataSource } from 'typeorm';
import { Category } from '../../modules/catalog/entities/category.entity';

// URL gốc để lưu vào DB cho ảnh/icon sản phẩm. Vì next.config.js đã BẬT
// lại Next.js Image Optimization (không còn unoptimized: true), việc fetch
// ảnh gốc để resize/nén xảy ra TRÊN SERVER (bên trong container frontend)
// — nên URL này phải là địa chỉ mà CONTAINER FRONTEND phân giải được:
//   - Chạy qua Docker Compose (mặc định, khuyến nghị) -> "http://minio:9000/electronics-shop"
//   - Chạy "npm run dev" trực tiếp trên máy host (không qua Docker)
//     -> đổi thành "http://localhost:9000/electronics-shop"
//   - Deploy thật dùng AWS S3 / CDN riêng -> đổi thành domain thật, ví dụ
//     "https://electronics-shop.s3.ap-southeast-1.amazonaws.com"
// Set qua biến môi trường, không sửa trực tiếp trong file này:
//   SEED_MEDIA_BASE_URL=http://localhost:9000/electronics-shop npx ts-node src/database/seeds/run-seeds.ts
const MEDIA_BASE_URL =
  process.env.SEED_MEDIA_BASE_URL || 'http://localhost:9000/electronics-shop';

export async function seedCategories(dataSource: DataSource) {
  const repo = dataSource.getRepository(Category);

  const categories: Partial<Category>[] = [
    {
      name: 'Điện thoại',
      slug: 'dien-thoai',
      iconUrl: `${MEDIA_BASE_URL}/products/icons/phone.svg`,
      specFields: ['Màn hình', 'Camera', 'Pin', 'RAM', 'Bộ nhớ', 'Chip xử lý', 'Hệ điều hành'],
    },
    {
      name: 'Laptop',
      slug: 'laptop',
      iconUrl: `${MEDIA_BASE_URL}/products/icons/laptop.svg`,
      specFields: ['CPU', 'RAM', 'Ổ cứng', 'Màn hình', 'Card đồ họa', 'Pin', 'Hệ điều hành'],
    },
    {
      name: 'Tai nghe',
      slug: 'tai-nghe',
      iconUrl: `${MEDIA_BASE_URL}/products/icons/headphone.svg`,
      specFields: ['Loại kết nối', 'Driver', 'Chống ồn', 'Pin', 'Tần số đáp ứng'],
    },
    {
      name: 'Đồng hồ thông minh',
      slug: 'dong-ho-thong-minh',
      iconUrl: `${MEDIA_BASE_URL}/products/icons/smartwatch.svg`,
      specFields: ['Màn hình', 'Pin', 'Chống nước', 'GPS', 'Cảm biến nhịp tim'],
    },
    {
      name: 'Máy tính bảng',
      slug: 'may-tinh-bang',
      iconUrl: `${MEDIA_BASE_URL}/products/icons/tablet.svg`,
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