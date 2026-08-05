import { DataSource } from 'typeorm';
import {
  Product,
  ProductStatus,
} from '../../modules/catalog/entities/product.entity';
import { Category } from '../../modules/catalog/entities/category.entity';

// Xem giải thích chi tiết trong category.seed.ts — cùng 1 hằng số, tách
// riêng ở đây vì file này chạy độc lập (import trong run-seeds.ts).
const MEDIA_BASE_URL =
  process.env.SEED_MEDIA_BASE_URL || 'http://localhost:9000/electronics-shop';

export async function seedProducts(dataSource: DataSource) {
  const productRepo = dataSource.getRepository(Product);
  const categoryRepo = dataSource.getRepository(Category);

  const cat = async (slug: string) => {
    const c = await categoryRepo.findOneBy({ slug });
    if (!c) throw new Error(`Category không tìm thấy: ${slug}`);
    return c;
  };

  const dienThoai = await cat('dien-thoai');
  const laptop = await cat('laptop');
  const taiNghe = await cat('tai-nghe');
  const dongHo = await cat('dong-ho-thong-minh');
  const mayTinhBang = await cat('may-tinh-bang');

  const products: Partial<Product>[] = [
    // ── ĐIỆN THOẠI ──
    {
      name: 'iPhone 17 Pro Max',
      slug: 'iphone-17-pro-max',
      brand: 'Apple',
      description:
        'iPhone 17 Pro Max với chip A17 Pro mạnh mẽ, camera 48MP, màn hình Super Retina XDR 6.7 inch và khung titanium cao cấp. Hỗ trợ USB-C 3.0 và Action Button tùy chỉnh.',
      price: 34990000,
      salePrice: 32990000,
      images: [
        {
          url: `${MEDIA_BASE_URL}/products/iphone17promax/1.jpg`,
          key: 'products/iphone17promax/1.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/iphone17promax/2.jpg`,
          key: 'products/iphone17promax/2.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/iphone17promax/3.jpg`,
          key: 'products/iphone17promax/3.jpg',
        },
      ],
      specs: {
        'Màn hình': '6.7 inch Super Retina XDR LTPO OLED 120Hz',
        Camera: '48MP chính + 12MP góc siêu rộng + 12MP tele 5x',
        Pin: '4422 mAh',
        RAM: '8 GB',
        'Bộ nhớ': '256 GB',
        'Chip xử lý': 'Apple A17 Pro',
        'Hệ điều hành': 'iOS 17',
      },
      status: ProductStatus.ACTIVE,
      soldCount: 320,
      viewCount: 15400,
      category: dienThoai,
    },
    {
      name: 'Samsung Galaxy S24 Ultra',
      slug: 'samsung-galaxy-s24-ultra',
      brand: 'Samsung',
      description:
        'Galaxy S24 Ultra trang bị bút S Pen tích hợp, camera 200MP, chip Snapdragon 8 Gen 3 và màn hình Dynamic AMOLED 2X 6.8 inch 120Hz. Khung titanium, kháng nước IP68.',
      price: 31990000,
      salePrice: 29990000,
      images: [
        {
          url: `${MEDIA_BASE_URL}/products/s24ultra/1.jpg`,
          key: 'products/s24ultra/1.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/s24ultra/2.jpg`,
          key: 'products/s24ultra/2.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/s24ultra/3.jpg`,
          key: 'products/s24ultra/3.jpg',
        },
      ],
      specs: {
        'Màn hình': '6.8 inch Dynamic AMOLED 2X 120Hz',
        Camera:
          '200MP chính + 12MP góc siêu rộng + 10MP tele 3x + 50MP tele 5x',
        Pin: '5000 mAh',
        RAM: '12 GB',
        'Bộ nhớ': '256 GB',
        'Chip xử lý': 'Snapdragon 8 Gen 3',
        'Hệ điều hành': 'Android 14 / One UI 6.1',
      },
      status: ProductStatus.ACTIVE,
      soldCount: 210,
      viewCount: 12800,
      category: dienThoai,
    },
    {
      name: 'Xiaomi 17 Ultra',
      slug: 'xiaomi-17-ultra',
      brand: 'Xiaomi',
      description:
        'Xiaomi 17 Ultra với hệ thống camera Leica hàng đầu, chip Snapdragon 8 Gen 3, màn hình AMOLED 6.73 inch 120Hz và sạc nhanh 90W không dây.',
      price: 22990000,
      salePrice: 20990000,
      images: [
        {
          url: `${MEDIA_BASE_URL}/products/xiaomi17ultra/1.jpg`,
          key: 'products/xiaomi17ultra/1.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/xiaomi17ultra/2.jpg`,
          key: 'products/xiaomi17ultra/2.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/xiaomi17ultra/3.jpg`,
          key: 'products/xiaomi17ultra/3.jpg',
        },
      ],
      specs: {
        'Màn hình': '6.73 inch AMOLED 120Hz',
        Camera:
          '50MP chính Leica + 50MP góc siêu rộng + 50MP tele 3.2x + 50MP tele 5x',
        Pin: '5000 mAh',
        RAM: '16 GB',
        'Bộ nhớ': '512 GB',
        'Chip xử lý': 'Snapdragon 8 Gen 3',
        'Hệ điều hành': 'Android 14 / HyperOS',
      },
      status: ProductStatus.ACTIVE,
      soldCount: 95,
      viewCount: 7200,
      category: dienThoai,
    },

    // ── LAPTOP ──
    {
      name: 'MacBook Pro 16 inch M3 Pro',
      slug: 'macbook-pro-16-m3-pro',
      brand: 'Apple',
      description:
        'MacBook Pro 16 inch với chip M3 Pro 12-core, màn hình Liquid Retina XDR 3456×2234, thời lượng pin lên đến 22 giờ và bộ nhớ hợp nhất 18GB tốc độ cao.',
      price: 69990000,
      salePrice: 66990000,
      images: [
        {
          url: `${MEDIA_BASE_URL}/products/mbp16m3pro/1.jpg`,
          key: 'products/mbp16m3pro/1.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/mbp16m3pro/2.jpg`,
          key: 'products/mbp16m3pro/2.jpg',
        },
      ],
      specs: {
        CPU: 'Apple M3 Pro 12-core',
        RAM: '18 GB Unified Memory',
        'Ổ cứng': '512 GB SSD',
        'Màn hình': '16.2 inch Liquid Retina XDR 120Hz',
        'Card đồ họa': '18-core GPU',
        Pin: '100Wh — ~22 giờ',
        'Hệ điều hành': 'macOS Sonoma',
      },
      status: ProductStatus.ACTIVE,
      soldCount: 145,
      viewCount: 18900,
      category: laptop,
    },
    {
      name: 'Dell XPS 15 9530',
      slug: 'dell-xps-15-9530',
      brand: 'Dell',
      description:
        'Dell XPS 15 9530 với chip Intel Core i7-13700H, card RTX 4060, màn hình OLED 3.5K cảm ứng 60Hz và thiết kế mỏng nhẹ cao cấp. Phù hợp đồ họa và lập trình.',
      price: 45990000,
      salePrice: 42990000,
      images: [
        {
          url: `${MEDIA_BASE_URL}/products/dellxps15/1.jpg`,
          key: 'products/dellxps15/1.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/dellxps15/2.jpg`,
          key: 'products/dellxps15/2.jpg',
        },
      ],
      specs: {
        CPU: 'Intel Core i7-13700H',
        RAM: '16 GB DDR5 4800MHz',
        'Ổ cứng': '512 GB PCIe NVMe SSD',
        'Màn hình': '15.6 inch OLED 3.5K cảm ứng 60Hz',
        'Card đồ họa': 'NVIDIA RTX 4060 8GB',
        Pin: '86Wh — ~8 giờ',
        'Hệ điều hành': 'Windows 11 Home',
      },
      status: ProductStatus.ACTIVE,
      soldCount: 88,
      viewCount: 9300,
      category: laptop,
    },
    {
      name: 'ASUS ROG Zephyrus G14 2024',
      slug: 'asus-rog-zephyrus-g14-2024',
      brand: 'ASUS',
      description:
        'ROG Zephyrus G14 2024 với AMD Ryzen 9 8945HS, RTX 4070, màn hình OLED 2.8K 120Hz và trọng lượng chỉ 1.65 kg. Gaming mỏng nhẹ hàng đầu phân khúc.',
      price: 39990000,
      salePrice: undefined,
      images: [
        {
          url: `${MEDIA_BASE_URL}/products/rogg14-2024/1.jpg`,
          key: 'products/rogg14-2024/1.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/rogg14-2024/2.jpg`,
          key: 'products/rogg14-2024/2.jpg',
        },
      ],
      specs: {
        CPU: 'AMD Ryzen 9 8945HS',
        RAM: '16 GB LPDDR5X',
        'Ổ cứng': '1 TB PCIe 4.0 SSD',
        'Màn hình': '14 inch OLED 2.8K 120Hz',
        'Card đồ họa': 'NVIDIA RTX 4070 8GB',
        Pin: '73Wh — ~10 giờ',
        'Hệ điều hành': 'Windows 11 Home',
      },
      status: ProductStatus.ACTIVE,
      soldCount: 62,
      viewCount: 8100,
      category: laptop,
    },

    // ── TAI NGHE ──
    {
      name: 'Sony WH-1000XM5',
      slug: 'sony-wh-1000xm5',
      brand: 'Sony',
      description:
        'Tai nghe chống ồn hàng đầu Sony WH-1000XM5 với 8 micro và 2 chip xử lý, âm thanh Hi-Res LDAC, pin 30 giờ và gập lại gọn cho di chuyển.',
      price: 8990000,
      salePrice: 7490000,
      images: [
        {
          url: `${MEDIA_BASE_URL}/products/sonywh1000xm5/1.jpg`,
          key: 'products/sonywh1000xm5/1.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/sonywh1000xm5/2.jpg`,
          key: 'products/sonywh1000xm5/2.jpg',
        },
      ],
      specs: {
        'Loại kết nối': 'Bluetooth 5.2 / 3.5mm jack',
        Driver: '30 mm',
        'Chống ồn': 'Có (ANC Dual Noise Sensor 8 mic)',
        Pin: '30 giờ (ANC bật)',
        'Tần số đáp ứng': '4 Hz – 40.000 Hz',
      },
      status: ProductStatus.ACTIVE,
      soldCount: 430,
      viewCount: 21000,
      category: taiNghe,
    },
    {
      name: 'Apple AirPods Pro 2',
      slug: 'apple-airpods-pro-2',
      brand: 'Apple',
      description:
        'AirPods Pro thế hệ 2 với chip H2, chống ồn ANC thế hệ mới, âm thanh Adaptive Audio thông minh và case MagSafe sạc USB-C. Kháng nước IPX4.',
      price: 6490000,
      salePrice: 5990000,
      images: [
        {
          url: `${MEDIA_BASE_URL}/products/airpodspro2/1.jpg`,
          key: 'products/airpodspro2/1.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/airpodspro2/2.jpg`,
          key: 'products/airpodspro2/2.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/airpodspro2/3.jpg`,
          key: 'products/airpodspro2/3.jpg',
        },
      ],
      specs: {
        'Loại kết nối': 'Bluetooth 5.3',
        Driver: 'Apple H2',
        'Chống ồn': 'Có (Active Noise Cancellation thế hệ 2)',
        Pin: '6h tai nghe + 30h với case',
        'Tần số đáp ứng': '20 Hz – 20.000 Hz',
      },
      status: ProductStatus.ACTIVE,
      soldCount: 560,
      viewCount: 25000,
      category: taiNghe,
    },

    // ── ĐỒNG HỒ THÔNG MINH ──
    {
      name: 'Apple Watch Series 9 45mm',
      slug: 'apple-watch-series-9-45mm',
      brand: 'Apple',
      description:
        'Apple Watch Series 9 với chip S9 SiP, tính năng Double Tap mới, màn hình Always-On Retina sáng hơn 2x, theo dõi sức khoẻ toàn diện và Carbon Neutral.',
      price: 12990000,
      salePrice: 11490000,
      images: [
        {
          url: `${MEDIA_BASE_URL}/products/applewatch-s9-45/1.jpg`,
          key: 'products/applewatch-s9-45/1.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/applewatch-s9-45/2.jpg`,
          key: 'products/applewatch-s9-45/2.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/applewatch-s9-45/3.jpg`,
          key: 'products/applewatch-s9-45/3.jpg',
        },
      ],
      specs: {
        'Màn hình': '45 mm Always-On Retina LTPO OLED',
        Pin: '~18 giờ (36h chế độ tiết kiệm)',
        'Chống nước': 'WR50 / swim-proof',
        GPS: 'Có (L1 và L5 dual-frequency)',
        'Cảm biến nhịp tim': 'Có (quang học thế hệ 3 + điện tâm đồ)',
      },
      status: ProductStatus.ACTIVE,
      soldCount: 275,
      viewCount: 16300,
      category: dongHo,
    },
    {
      name: 'Samsung Galaxy Watch 6 Classic 47mm',
      slug: 'samsung-galaxy-watch-6-classic-47mm',
      brand: 'Samsung',
      description:
        'Galaxy Watch 6 Classic với vòng bezel xoay vật lý huyền thoại, chip Exynos W930, đo thành phần cơ thể BIA và theo dõi giấc ngủ nâng cao.',
      price: 9490000,
      salePrice: 8290000,
      images: [
        {
          url: `${MEDIA_BASE_URL}/products/gw6classic47/1.jpg`,
          key: 'products/gw6classic47/1.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/gw6classic47/2.jpg`,
          key: 'products/gw6classic47/2.jpg',
        },
      ],
      specs: {
        'Màn hình': '47 mm Super AMOLED 480×480',
        Pin: '~40 giờ',
        'Chống nước': '5ATM + IP68',
        GPS: 'Có (L1 + BeiDou + GLONASS)',
        'Cảm biến nhịp tim': 'Có (quang học + BIA đo mỡ cơ thể)',
      },
      status: ProductStatus.ACTIVE,
      soldCount: 180,
      viewCount: 11200,
      category: dongHo,
    },

    // ── MÁY TÍNH BẢNG ──
    {
      name: 'iPad Pro 11 inch M4 Wi-Fi',
      slug: 'ipad-pro-11-m4-wifi',
      brand: 'Apple',
      description:
        'iPad Pro 11 inch M4 mỏng nhất từ trước đến nay (5.1mm) với màn hình Ultra Retina XDR OLED tandem 120Hz, chip M4 và hỗ trợ Apple Pencil Pro.',
      price: 23990000,
      salePrice: 22490000,
      images: [
        {
          url: `${MEDIA_BASE_URL}/products/ipadpro11m4/1.jpg`,
          key: 'products/ipadpro11m4/1.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/ipadpro11m4/2.jpg`,
          key: 'products/ipadpro11m4/2.jpg',
        },
      ],
      specs: {
        'Màn hình': '11 inch Ultra Retina XDR OLED tandem 120Hz',
        CPU: 'Apple M4',
        RAM: '8 GB',
        'Bộ nhớ': '256 GB',
        Pin: '~10 giờ',
        Camera: '12MP chính + 12MP góc siêu rộng',
        'Hệ điều hành': 'iPadOS 17',
      },
      status: ProductStatus.ACTIVE,
      soldCount: 130,
      viewCount: 14500,
      category: mayTinhBang,
    },
    {
      name: 'Samsung Galaxy Tab S9 FE',
      slug: 'samsung-galaxy-tab-s9-fe',
      brand: 'Samsung',
      description:
        'Galaxy Tab S9 FE với màn hình TFT 10.9 inch 90Hz, bút S Pen kèm hộp, chip Exynos 1380 và kháng nước IP68. Lựa chọn tầm trung giá trị cao.',
      price: 10490000,
      salePrice: 9290000,
      images: [
        {
          url: `${MEDIA_BASE_URL}/products/tabs9fe/1.jpg`,
          key: 'products/tabs9fe/1.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/tabs9fe/2.jpg`,
          key: 'products/tabs9fe/2.jpg',
        },
        {
          url: `${MEDIA_BASE_URL}/products/tabs9fe/3.jpg`,
          key: 'products/tabs9fe/3.jpg',
        },
      ],
      specs: {
        'Màn hình': '10.9 inch TFT 90Hz',
        CPU: 'Exynos 1380',
        RAM: '6 GB',
        'Bộ nhớ': '128 GB',
        Pin: '10090 mAh — ~13 giờ',
        Camera: '8MP chính + 10MP selfie',
        'Hệ điều hành': 'Android 13 / One UI 5.1',
      },
      status: ProductStatus.ACTIVE,
      soldCount: 98,
      viewCount: 8700,
      category: mayTinhBang,
    },
  ];

  for (const data of products) {
    const existing = await productRepo.findOneBy({ slug: data.slug });
    if (!existing) {
      await productRepo.save(productRepo.create(data));
      console.log(`  [products] ✔ Inserted: ${data.name}`);
    } else {
      console.log(`  [products] — Skipped (đã tồn tại): ${data.name}`);
    }
  }
}
