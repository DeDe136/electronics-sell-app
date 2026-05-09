import { DataSource } from 'typeorm';
import { CartItem } from '../../modules/cart/entities/cart-item.entity';
import { User } from '../../modules/user/entities/user.entity';
import { Product } from '../../modules/catalog/entities/product.entity';

interface CartSeed {
  userEmail: string;
  productSlug: string;
  variantId: string | undefined; // ✅ undefined thay vì null
  quantity: number;
}

export async function seedCartItems(dataSource: DataSource) {
  const cartRepo    = dataSource.getRepository(CartItem);
  const userRepo    = dataSource.getRepository(User);
  const productRepo = dataSource.getRepository(Product);

  const items: CartSeed[] = [
    // Nguyễn Văn An — đang xem iPad Pro 11
    { userEmail: 'nguyen.van.an@gmail.com', productSlug: 'ipad-pro-11-m4-wifi',        variantId: 'var-ipadpro11-1', quantity: 1 },
    // Trần Thị Bích — đang so sánh 2 điện thoại
    { userEmail: 'tran.thi.bich@gmail.com', productSlug: 'iphone-17-pro-max',           variantId: 'var-ip17pm-2',    quantity: 1 },
    { userEmail: 'tran.thi.bich@gmail.com', productSlug: 'xiaomi-17-ultra',             variantId: 'var-x17u-1',      quantity: 1 },
    // Lê Minh Cường — đang xem laptop gaming
    { userEmail: 'le.minh.cuong@gmail.com', productSlug: 'asus-rog-zephyrus-g14-2024', variantId: 'var-g14-1',       quantity: 1 },
  ];

  for (const seed of items) {
    const user = await userRepo.findOneBy({ email: seed.userEmail });
    if (!user) {
      console.warn(`  [cart] ⚠ User không tìm thấy: ${seed.userEmail}`);
      continue;
    }

    const product = await productRepo.findOneBy({ slug: seed.productSlug });
    if (!product) {
      console.warn(`  [cart] ⚠ Product không tìm thấy: ${seed.productSlug}`);
      continue;
    }

    // Tránh duplicate: cùng user + product + variant
    // ✅ undefined tương thích với FindOperator<string> | undefined
    const existing = await cartRepo.findOneBy({
      userId: user.id,
      productId: product.id,
      variantId: seed.variantId,
    });
    if (existing) {
      console.log(`  [cart] — Skipped (đã tồn tại): ${seed.userEmail} → ${seed.productSlug}`);
      continue;
    }

    // ✅ repo.create() nhận undefined, không nhận null
    const item = cartRepo.create({
      userId: user.id,
      productId: product.id,
      variantId: seed.variantId,
      quantity: seed.quantity,
    });
    await cartRepo.save(item);
    console.log(`  [cart] ✔ Inserted: ${seed.userEmail} → ${seed.productSlug} (variant: ${seed.variantId ?? 'none'})`);
  }
}