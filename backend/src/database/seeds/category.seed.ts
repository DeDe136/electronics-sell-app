import { DataSource } from 'typeorm';
import { Category } from '../../modules/catalog/entities/category.entity';

// (MỚI) Giống hệt nguyên tắc trong product.seed.ts — file này KHÔNG đi qua
// storageService.uploadFile()/buildPublicUrl(), tự ghép URL ngay tại đây
// mô phỏng đúng thao tác tay "upload qua UI MinIO/S3 rồi set URL vào DB".
// Giữ nguyên hành vi cũ khi STORAGE_PROVIDER=minio; khi STORAGE_PROVIDER=aws
// trả về "/api/images/{key}" — PHẢI khớp đúng key file .svg ta tự tay
// upload lên S3 console (ví dụ "products/icons/phone.svg").
//
// LƯU Ý: Category entity không có cột "key" riêng như Product.images[] —
// không cần thêm cột, vì "key" thật chất chính là phần path sau
// "/api/images/" trong iconUrl, route bên frontend tự tách ra được.
//
// (Ghi chú cũ, vẫn đúng cho nhánh minio): vì next.config.js đã bật lại
// Next.js Image Optimization, việc fetch ảnh gốc để resize/nén xảy ra TRÊN
// SERVER (container frontend) — nên URL nhánh minio phải là địa chỉ mà
// CONTAINER FRONTEND phân giải được (không phải "localhost" nếu chạy qua
// Docker Compose). Set qua biến môi trường, không sửa trực tiếp trong file
// này:
//   SEED_MEDIA_BASE_URL=http://localhost:9000/electronics-shop npx ts-node src/database/seeds/run-seeds.ts
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'minio';
const MEDIA_BASE_URL =
  process.env.SEED_MEDIA_BASE_URL || 'http://localhost:9000/electronics-shop';

function buildSeedImageUrl(key: string): string {
  if (STORAGE_PROVIDER === 'minio') {
    return `${MEDIA_BASE_URL}/${key}`;
  }
  return `/api/images/${key}`;
}

export async function seedCategories(dataSource: DataSource) {
  const repo = dataSource.getRepository(Category);

  const categories: Partial<Category>[] = [
    {
      name: 'Điện thoại',
      slug: 'dien-thoai',
      iconUrl: buildSeedImageUrl('products/icons/phone.svg'),
      specFields: [
        'Màn hình',
        'Camera',
        'Pin',
        'RAM',
        'Bộ nhớ',
        'Chip xử lý',
        'Hệ điều hành',
      ],
    },
    {
      name: 'Laptop',
      slug: 'laptop',
      iconUrl: buildSeedImageUrl('products/icons/laptop.svg'),
      specFields: [
        'CPU',
        'RAM',
        'Ổ cứng',
        'Màn hình',
        'Card đồ họa',
        'Pin',
        'Hệ điều hành',
      ],
    },
    {
      name: 'Tai nghe',
      slug: 'tai-nghe',
      iconUrl: buildSeedImageUrl('products/icons/headphone.svg'),
      specFields: [
        'Loại kết nối',
        'Driver',
        'Chống ồn',
        'Pin',
        'Tần số đáp ứng',
      ],
    },
    {
      name: 'Đồng hồ thông minh',
      slug: 'dong-ho-thong-minh',
      iconUrl: buildSeedImageUrl('products/icons/smartwatch.svg'),
      specFields: ['Màn hình', 'Pin', 'Chống nước', 'GPS', 'Cảm biến nhịp tim'],
    },
    {
      name: 'Máy tính bảng',
      slug: 'may-tinh-bang',
      iconUrl: buildSeedImageUrl('products/icons/tablet.svg'),
      specFields: [
        'Màn hình',
        'CPU',
        'RAM',
        'Bộ nhớ',
        'Pin',
        'Camera',
        'Hệ điều hành',
      ],
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
