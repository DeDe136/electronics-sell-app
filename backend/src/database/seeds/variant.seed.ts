import { DataSource } from 'typeorm';
import { ProductVariant } from '../../modules/catalog/entities/product-variant.entity';
import { Product } from '../../modules/catalog/entities/product.entity';

interface VariantSeed {
  productSlug: string;
  label: string;
  sku: string;
  price: number;
  specs: Record<string, string>;
}

export async function seedVariants(dataSource: DataSource) {
  const variantRepo = dataSource.getRepository(ProductVariant);
  const productRepo = dataSource.getRepository(Product);

  const variants: VariantSeed[] = [
    // ── iPhone 15 Pro Max ──
    { productSlug: 'iphone-15-pro-max', label: '256GB - Titan Tự nhiên', sku: 'IP15PM-256-NAT', price: 34990000, specs: { 'Màu': 'Titan Tự nhiên', 'Bộ nhớ': '256GB' } },
    { productSlug: 'iphone-15-pro-max', label: '256GB - Titan Đen',      sku: 'IP15PM-256-BLK', price: 34990000, specs: { 'Màu': 'Titan Đen',      'Bộ nhớ': '256GB' } },
    { productSlug: 'iphone-15-pro-max', label: '512GB - Titan Trắng',    sku: 'IP15PM-512-WHT', price: 40990000, specs: { 'Màu': 'Titan Trắng',    'Bộ nhớ': '512GB' } },

    // ── Samsung Galaxy S24 Ultra ──
    { productSlug: 'samsung-galaxy-s24-ultra', label: '256GB - Titanium Black', sku: 'S24U-256-BLK', price: 31990000, specs: { 'Màu': 'Titanium Black', 'Bộ nhớ': '256GB' } },
    { productSlug: 'samsung-galaxy-s24-ultra', label: '512GB - Titanium Gray',  sku: 'S24U-512-GRY', price: 36990000, specs: { 'Màu': 'Titanium Gray',  'Bộ nhớ': '512GB' } },

    // ── Xiaomi 14 Ultra ──
    { productSlug: 'xiaomi-14-ultra', label: '512GB - Trắng', sku: 'X14U-512-WHT', price: 22990000, specs: { 'Màu': 'Trắng', 'Bộ nhớ': '512GB' } },
    { productSlug: 'xiaomi-14-ultra', label: '512GB - Đen',   sku: 'X14U-512-BLK', price: 22990000, specs: { 'Màu': 'Đen',   'Bộ nhớ': '512GB' } },

    // ── MacBook Pro 16 M3 Pro ──
    { productSlug: 'macbook-pro-16-m3-pro', label: '18GB / 512GB - Bạc',           sku: 'MBP16-M3P-18-512-SIL', price: 69990000, specs: { 'Màu': 'Bạc',           'RAM': '18GB', 'Ổ cứng': '512GB' } },
    { productSlug: 'macbook-pro-16-m3-pro', label: '18GB / 512GB - Đen không gian', sku: 'MBP16-M3P-18-512-BLK', price: 69990000, specs: { 'Màu': 'Đen không gian', 'RAM': '18GB', 'Ổ cứng': '512GB' } },
    { productSlug: 'macbook-pro-16-m3-pro', label: '36GB / 1TB - Bạc',              sku: 'MBP16-M3P-36-1T-SIL',  price: 89990000, specs: { 'Màu': 'Bạc',           'RAM': '36GB', 'Ổ cứng': '1TB'   } },

    // ── Dell XPS 15 9530 ──
    { productSlug: 'dell-xps-15-9530', label: '16GB / 512GB - Bạch kim', sku: 'XPS15-9530-16-512-PLT', price: 45990000, specs: { 'Màu': 'Bạch kim', 'RAM': '16GB', 'Ổ cứng': '512GB' } },
    { productSlug: 'dell-xps-15-9530', label: '32GB / 1TB - Đen',         sku: 'XPS15-9530-32-1T-BLK',  price: 56990000, specs: { 'Màu': 'Đen',      'RAM': '32GB', 'Ổ cứng': '1TB'   } },

    // ── ASUS ROG Zephyrus G14 2024 ──
    { productSlug: 'asus-rog-zephyrus-g14-2024', label: '16GB / 1TB - Eclipse Gray',   sku: 'G14-2024-16-1T-GRY', price: 39990000, specs: { 'Màu': 'Eclipse Gray',   'RAM': '16GB', 'Ổ cứng': '1TB' } },
    { productSlug: 'asus-rog-zephyrus-g14-2024', label: '32GB / 1TB - Platinum White', sku: 'G14-2024-32-1T-WHT', price: 46990000, specs: { 'Màu': 'Platinum White', 'RAM': '32GB', 'Ổ cứng': '1TB' } },

    // ── Sony WH-1000XM5 ──
    { productSlug: 'sony-wh-1000xm5', label: 'Đen', sku: 'WH1000XM5-BLK', price: 8990000, specs: { 'Màu': 'Đen' } },
    { productSlug: 'sony-wh-1000xm5', label: 'Bạc', sku: 'WH1000XM5-SIL', price: 8990000, specs: { 'Màu': 'Bạc' } },

    // ── Apple AirPods Pro 2 — không có variant (bỏ qua, inventory gắn thẳng product) ──

    // ── Apple Watch Series 9 45mm ──
    { productSlug: 'apple-watch-series-9-45mm', label: '45mm Nhôm - Midnight',         sku: 'AWS9-45-ALU-MID', price: 12990000, specs: { 'Màu': 'Midnight',   'Vật liệu': 'Nhôm'          } },
    { productSlug: 'apple-watch-series-9-45mm', label: '45mm Nhôm - Starlight',        sku: 'AWS9-45-ALU-STR', price: 12990000, specs: { 'Màu': 'Starlight',  'Vật liệu': 'Nhôm'          } },
    { productSlug: 'apple-watch-series-9-45mm', label: '45mm Thép không gỉ - Vàng',   sku: 'AWS9-45-SS-GLD',  price: 18990000, specs: { 'Màu': 'Vàng',       'Vật liệu': 'Thép không gỉ' } },

    // ── Samsung Galaxy Watch 6 Classic 47mm ──
    { productSlug: 'samsung-galaxy-watch-6-classic-47mm', label: '47mm - Đen', sku: 'GW6C-47-BLK', price: 9490000, specs: { 'Màu': 'Đen' } },
    { productSlug: 'samsung-galaxy-watch-6-classic-47mm', label: '47mm - Bạc', sku: 'GW6C-47-SIL', price: 9490000, specs: { 'Màu': 'Bạc' } },

    // ── iPad Pro 11 inch M4 Wi-Fi ──
    { productSlug: 'ipad-pro-11-m4-wifi', label: '256GB Wi-Fi - Bạc',           sku: 'IPADPRO11-M4-256-WIFI-SIL', price: 23990000, specs: { 'Màu': 'Bạc',           'Bộ nhớ': '256GB', 'Kết nối': 'Wi-Fi' } },
    { productSlug: 'ipad-pro-11-m4-wifi', label: '512GB Wi-Fi - Đen không gian', sku: 'IPADPRO11-M4-512-WIFI-BLK', price: 30990000, specs: { 'Màu': 'Đen không gian', 'Bộ nhớ': '512GB', 'Kết nối': 'Wi-Fi' } },

    // ── Samsung Galaxy Tab S9 FE ──
    { productSlug: 'samsung-galaxy-tab-s9-fe', label: '128GB Wi-Fi - Xanh lam', sku: 'TABS9FE-128-WIFI-BLU', price: 10490000, specs: { 'Màu': 'Xanh lam', 'Bộ nhớ': '128GB' } },
    { productSlug: 'samsung-galaxy-tab-s9-fe', label: '128GB Wi-Fi - Bạc',       sku: 'TABS9FE-128-WIFI-SIL', price: 10490000, specs: { 'Màu': 'Bạc',      'Bộ nhớ': '128GB' } },
  ];

  for (const data of variants) {
    const existing = await variantRepo.findOneBy({ sku: data.sku });
    if (existing) {
      console.log(`  [variants] — Skipped (đã tồn tại): ${data.sku}`);
      continue;
    }

    const product = await productRepo.findOneBy({ slug: data.productSlug });
    if (!product) {
      console.warn(`  [variants] ⚠ Product không tìm thấy: ${data.productSlug} — bỏ qua ${data.sku}`);
      continue;
    }

    const variant = variantRepo.create({
      label: data.label,
      sku: data.sku,
      price: data.price,
      specs: data.specs,
      productId: product.id,
    });
    await variantRepo.save(variant);
    console.log(`  [variants] ✔ Inserted: ${data.sku}`);
  }
}