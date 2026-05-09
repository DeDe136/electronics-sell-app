import { DataSource } from 'typeorm';
import { Inventory } from '../../modules/inventory/entities/inventory.entity';
import { Product } from '../../modules/catalog/entities/product.entity';

interface InventoryRow {
  sku: string;
  productSlug: string;
  variantId: string | null;
  quantity: number;
  reserved: number;
  lowStockThreshold: number;
}

export async function seedInventory(dataSource: DataSource) {
  const invRepo     = dataSource.getRepository(Inventory);
  const productRepo = dataSource.getRepository(Product);

  const rows: InventoryRow[] = [
    // iPhone 15 Pro Max
    { sku: 'IP15PM-256-NAT', productSlug: 'iphone-15-pro-max', variantId: 'var-ip15pm-1', quantity: 50, reserved: 5,  lowStockThreshold: 10 },
    { sku: 'IP15PM-256-BLK', productSlug: 'iphone-15-pro-max', variantId: 'var-ip15pm-2', quantity: 40, reserved: 3,  lowStockThreshold: 10 },
    { sku: 'IP15PM-512-WHT', productSlug: 'iphone-15-pro-max', variantId: 'var-ip15pm-3', quantity: 20, reserved: 2,  lowStockThreshold: 5  },
    // Samsung S24 Ultra
    { sku: 'S24U-256-BLK',   productSlug: 'samsung-galaxy-s24-ultra', variantId: 'var-s24u-1', quantity: 60, reserved: 8, lowStockThreshold: 10 },
    { sku: 'S24U-512-GRY',   productSlug: 'samsung-galaxy-s24-ultra', variantId: 'var-s24u-2', quantity: 25, reserved: 1, lowStockThreshold: 5  },
    // Xiaomi 14 Ultra
    { sku: 'X14U-512-WHT', productSlug: 'xiaomi-14-ultra', variantId: 'var-x14u-1', quantity: 30, reserved: 2, lowStockThreshold: 5 },
    { sku: 'X14U-512-BLK', productSlug: 'xiaomi-14-ultra', variantId: 'var-x14u-2', quantity: 30, reserved: 0, lowStockThreshold: 5 },
    // MacBook Pro 16
    { sku: 'MBP16-M3P-18-512-SIL', productSlug: 'macbook-pro-16-m3-pro', variantId: 'var-mbp16-1', quantity: 20, reserved: 3, lowStockThreshold: 5 },
    { sku: 'MBP16-M3P-18-512-BLK', productSlug: 'macbook-pro-16-m3-pro', variantId: 'var-mbp16-2', quantity: 20, reserved: 2, lowStockThreshold: 5 },
    { sku: 'MBP16-M3P-36-1T-SIL',  productSlug: 'macbook-pro-16-m3-pro', variantId: 'var-mbp16-3', quantity: 10, reserved: 1, lowStockThreshold: 3 },
    // Dell XPS 15
    { sku: 'XPS15-9530-16-512-PLT', productSlug: 'dell-xps-15-9530', variantId: 'var-xps15-1', quantity: 25, reserved: 2, lowStockThreshold: 5 },
    { sku: 'XPS15-9530-32-1T-BLK',  productSlug: 'dell-xps-15-9530', variantId: 'var-xps15-2', quantity: 15, reserved: 1, lowStockThreshold: 3 },
    // ROG Zephyrus G14
    { sku: 'G14-2024-16-1T-GRY', productSlug: 'asus-rog-zephyrus-g14-2024', variantId: 'var-g14-1', quantity: 18, reserved: 0, lowStockThreshold: 5 },
    { sku: 'G14-2024-32-1T-WHT', productSlug: 'asus-rog-zephyrus-g14-2024', variantId: 'var-g14-2', quantity: 10, reserved: 1, lowStockThreshold: 3 },
    // Sony WH-1000XM5
    { sku: 'WH1000XM5-BLK', productSlug: 'sony-wh-1000xm5', variantId: 'var-xm5-1', quantity: 80, reserved: 10, lowStockThreshold: 15 },
    { sku: 'WH1000XM5-SIL', productSlug: 'sony-wh-1000xm5', variantId: 'var-xm5-2', quantity: 60, reserved: 5,  lowStockThreshold: 10 },
    // AirPods Pro 2 — không có variant
    { sku: 'AIRPODSPRO2', productSlug: 'apple-airpods-pro-2', variantId: null, quantity: 120, reserved: 15, lowStockThreshold: 20 },
    // Apple Watch S9
    { sku: 'AWS9-45-ALU-MID', productSlug: 'apple-watch-series-9-45mm', variantId: 'var-aws9-1', quantity: 45, reserved: 5, lowStockThreshold: 10 },
    { sku: 'AWS9-45-ALU-STR', productSlug: 'apple-watch-series-9-45mm', variantId: 'var-aws9-2', quantity: 45, reserved: 3, lowStockThreshold: 10 },
    { sku: 'AWS9-45-SS-GLD',  productSlug: 'apple-watch-series-9-45mm', variantId: 'var-aws9-3', quantity: 15, reserved: 1, lowStockThreshold: 5  },
    // Galaxy Watch 6 Classic
    { sku: 'GW6C-47-BLK', productSlug: 'samsung-galaxy-watch-6-classic-47mm', variantId: 'var-gw6c-1', quantity: 35, reserved: 4, lowStockThreshold: 8 },
    { sku: 'GW6C-47-SIL', productSlug: 'samsung-galaxy-watch-6-classic-47mm', variantId: 'var-gw6c-2', quantity: 30, reserved: 2, lowStockThreshold: 8 },
    // iPad Pro 11 M4
    { sku: 'IPADPRO11-M4-256-WIFI-SIL', productSlug: 'ipad-pro-11-m4-wifi', variantId: 'var-ipadpro11-1', quantity: 30, reserved: 3, lowStockThreshold: 8 },
    { sku: 'IPADPRO11-M4-512-WIFI-BLK', productSlug: 'ipad-pro-11-m4-wifi', variantId: 'var-ipadpro11-2', quantity: 20, reserved: 2, lowStockThreshold: 5 },
    // Galaxy Tab S9 FE
    { sku: 'TABS9FE-128-WIFI-BLU', productSlug: 'samsung-galaxy-tab-s9-fe', variantId: 'var-tabs9fe-1', quantity: 40, reserved: 4, lowStockThreshold: 8 },
    { sku: 'TABS9FE-128-WIFI-SIL', productSlug: 'samsung-galaxy-tab-s9-fe', variantId: 'var-tabs9fe-2', quantity: 40, reserved: 3, lowStockThreshold: 8 },
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

    const inv = invRepo.create({
      sku: row.sku,
      productId: product.id,
      variantId: row.variantId,
      quantity: row.quantity,
      reserved: row.reserved,
      lowStockThreshold: row.lowStockThreshold,
    });
    await invRepo.save(inv);
    console.log(`  [inventory] ✔ Inserted: ${row.sku}`);
  }
}