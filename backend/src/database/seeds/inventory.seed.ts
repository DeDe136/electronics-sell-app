import { DataSource } from 'typeorm';
import { Inventory } from '../../modules/inventory/entities/inventory.entity';
import { Product } from '../../modules/catalog/entities/product.entity';
import { ProductVariant } from '../../modules/catalog/entities/product-variant.entity';

interface InventoryRow {
  sku: string;
  productSlug: string;
  /** SKU của variant tương ứng (undefined = sản phẩm không có variant) */
  variantSku: string | undefined; // ✅ undefined thay vì null
  quantity: number;
  reserved: number;
  lowStockThreshold: number;
}

export async function seedInventory(dataSource: DataSource) {
  const invRepo     = dataSource.getRepository(Inventory);
  const productRepo = dataSource.getRepository(Product);
  const variantRepo = dataSource.getRepository(ProductVariant);

  const rows: InventoryRow[] = [
    // iPhone 17 Pro Max
    { sku: 'IP17PM-256-NAT', productSlug: 'iphone-17-pro-max', variantSku: 'IP17PM-256-NAT', quantity: 50, reserved: 5,  lowStockThreshold: 10 },
    { sku: 'IP17PM-256-BLK', productSlug: 'iphone-17-pro-max', variantSku: 'IP17PM-256-BLK', quantity: 40, reserved: 3,  lowStockThreshold: 10 },
    { sku: 'IP17PM-512-WHT', productSlug: 'iphone-17-pro-max', variantSku: 'IP17PM-512-WHT', quantity: 20, reserved: 2,  lowStockThreshold: 5  },
    // Samsung S24 Ultra
    { sku: 'S24U-256-BLK',   productSlug: 'samsung-galaxy-s24-ultra', variantSku: 'S24U-256-BLK', quantity: 60, reserved: 8, lowStockThreshold: 10 },
    { sku: 'S24U-512-GRY',   productSlug: 'samsung-galaxy-s24-ultra', variantSku: 'S24U-512-GRY', quantity: 25, reserved: 1, lowStockThreshold: 5  },
    // Xiaomi 17 Ultra
    { sku: 'X17U-512-WHT', productSlug: 'xiaomi-17-ultra', variantSku: 'X17U-512-WHT', quantity: 30, reserved: 2, lowStockThreshold: 5 },
    { sku: 'X17U-512-BLK', productSlug: 'xiaomi-17-ultra', variantSku: 'X17U-512-BLK', quantity: 30, reserved: 0, lowStockThreshold: 5 },
    // MacBook Pro 16
    { sku: 'MBP16-M3P-18-512-SIL', productSlug: 'macbook-pro-16-m3-pro', variantSku: 'MBP16-M3P-18-512-SIL', quantity: 20, reserved: 3, lowStockThreshold: 5 },
    { sku: 'MBP16-M3P-18-512-BLK', productSlug: 'macbook-pro-16-m3-pro', variantSku: 'MBP16-M3P-18-512-BLK', quantity: 20, reserved: 2, lowStockThreshold: 5 },
    { sku: 'MBP16-M3P-36-1T-SIL',  productSlug: 'macbook-pro-16-m3-pro', variantSku: 'MBP16-M3P-36-1T-SIL',  quantity: 10, reserved: 1, lowStockThreshold: 3 },
    // Dell XPS 15
    { sku: 'XPS15-9530-16-512-PLT', productSlug: 'dell-xps-15-9530', variantSku: 'XPS15-9530-16-512-PLT', quantity: 25, reserved: 2, lowStockThreshold: 5 },
    { sku: 'XPS15-9530-32-1T-BLK',  productSlug: 'dell-xps-15-9530', variantSku: 'XPS15-9530-32-1T-BLK',  quantity: 15, reserved: 1, lowStockThreshold: 3 },
    // ROG Zephyrus G14
    { sku: 'G14-2024-16-1T-GRY', productSlug: 'asus-rog-zephyrus-g14-2024', variantSku: 'G14-2024-16-1T-GRY', quantity: 18, reserved: 0, lowStockThreshold: 5 },
    { sku: 'G14-2024-32-1T-WHT', productSlug: 'asus-rog-zephyrus-g14-2024', variantSku: 'G14-2024-32-1T-WHT', quantity: 10, reserved: 1, lowStockThreshold: 3 },
    // Sony WH-1000XM5
    { sku: 'WH1000XM5-BLK', productSlug: 'sony-wh-1000xm5', variantSku: 'WH1000XM5-BLK', quantity: 80, reserved: 10, lowStockThreshold: 15 },
    { sku: 'WH1000XM5-SIL', productSlug: 'sony-wh-1000xm5', variantSku: 'WH1000XM5-SIL', quantity: 60, reserved: 5,  lowStockThreshold: 10 },
    // AirPods Pro 2 — không có variant
    { sku: 'AIRPODSPRO2', productSlug: 'apple-airpods-pro-2', variantSku: undefined, quantity: 120, reserved: 15, lowStockThreshold: 20 },
    // Apple Watch S9
    { sku: 'AWS9-45-ALU-MID', productSlug: 'apple-watch-series-9-45mm', variantSku: 'AWS9-45-ALU-MID', quantity: 45, reserved: 5, lowStockThreshold: 10 },
    { sku: 'AWS9-45-ALU-STR', productSlug: 'apple-watch-series-9-45mm', variantSku: 'AWS9-45-ALU-STR', quantity: 45, reserved: 3, lowStockThreshold: 10 },
    { sku: 'AWS9-45-SS-GLD',  productSlug: 'apple-watch-series-9-45mm', variantSku: 'AWS9-45-SS-GLD',  quantity: 15, reserved: 1, lowStockThreshold: 5  },
    // Galaxy Watch 6 Classic
    { sku: 'GW6C-47-BLK', productSlug: 'samsung-galaxy-watch-6-classic-47mm', variantSku: 'GW6C-47-BLK', quantity: 35, reserved: 4, lowStockThreshold: 8 },
    { sku: 'GW6C-47-SIL', productSlug: 'samsung-galaxy-watch-6-classic-47mm', variantSku: 'GW6C-47-SIL', quantity: 30, reserved: 2, lowStockThreshold: 8 },
    // iPad Pro 11 M4
    { sku: 'IPADPRO11-M4-256-WIFI-SIL', productSlug: 'ipad-pro-11-m4-wifi', variantSku: 'IPADPRO11-M4-256-WIFI-SIL', quantity: 30, reserved: 3, lowStockThreshold: 8 },
    { sku: 'IPADPRO11-M4-512-WIFI-BLK', productSlug: 'ipad-pro-11-m4-wifi', variantSku: 'IPADPRO11-M4-512-WIFI-BLK', quantity: 20, reserved: 2, lowStockThreshold: 5 },
    // Galaxy Tab S9 FE
    { sku: 'TABS9FE-128-WIFI-BLU', productSlug: 'samsung-galaxy-tab-s9-fe', variantSku: 'TABS9FE-128-WIFI-BLU', quantity: 40, reserved: 4, lowStockThreshold: 8 },
    { sku: 'TABS9FE-128-WIFI-SIL', productSlug: 'samsung-galaxy-tab-s9-fe', variantSku: 'TABS9FE-128-WIFI-SIL', quantity: 40, reserved: 3, lowStockThreshold: 8 },
  ];

  for (const row of rows) {
    const existing = await invRepo.findOneBy({ sku: row.sku });
    if (existing) {
      console.log(`  [inventory] — Skipped (đã tồn tại): ${row.sku}`);
      continue;
    }

    const product = await productRepo.findOneBy({ slug: row.productSlug });
    if (!product) {
      console.warn(`  [inventory] ⚠ Product không tìm thấy: ${row.productSlug} — bỏ qua ${row.sku}`);
      continue;
    }

    // Tra cứu variantId thực tế theo SKU thay vì dùng ID hardcoded
    let variantId: string | undefined = undefined; // ✅ undefined thay vì null
    if (row.variantSku !== undefined) {
      const variant = await variantRepo.findOneBy({ sku: row.variantSku });
      if (!variant) {
        console.warn(`  [inventory] ⚠ Variant không tìm thấy (sku=${row.variantSku}) — bỏ qua ${row.sku}`);
        continue;
      }
      variantId = variant.id;
    }

    // ✅ repo.create() nhận undefined, không nhận null
    const inv = invRepo.create({
      sku: row.sku,
      productId: product.id,
      variantId,
      quantity: row.quantity,
      reserved: row.reserved,
      lowStockThreshold: row.lowStockThreshold,
    });
    await invRepo.save(inv);
    console.log(`  [inventory] ✔ Inserted: ${row.sku}`);
  }
}