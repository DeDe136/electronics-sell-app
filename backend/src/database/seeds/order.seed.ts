import { DataSource } from 'typeorm';
import { Order, OrderStatus } from '../../modules/order/entities/order.entity';
import { OrderItem } from '../../modules/order/entities/order-item.entity';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../../modules/payment/entities/payment.entity';
import { User } from '../../modules/user/entities/user.entity';
import { Product } from '../../modules/catalog/entities/product.entity';

interface OrderSeedItem {
  productSlug: string;
  variantLabel: string | undefined; // ✅ undefined thay vì null
  unitPrice: number;
  quantity: number;
}

interface OrderSeed {
  orderCode: string;
  userEmail: string;
  shippingAddress: {
    fullName: string;
    phone: string;
    address: string;
    ward: string;
    district: string;
    city: string;
  };
  shippingFee: number;
  discount: number;
  status: OrderStatus;
  note: string | undefined; // ✅ undefined thay vì null
  items: OrderSeedItem[];
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    transactionId: string | undefined; // ✅ undefined thay vì null
    metadata: Record<string, any>;
  };
  createdDaysAgo: number;
}

export async function seedOrders(dataSource: DataSource) {
  const orderRepo = dataSource.getRepository(Order);
  const itemRepo = dataSource.getRepository(OrderItem);
  const paymentRepo = dataSource.getRepository(Payment);
  const userRepo = dataSource.getRepository(User);
  const productRepo = dataSource.getRepository(Product);

  const orders: OrderSeed[] = [
    // ── Đơn 1: đã giao, thanh toán bank transfer ──
    {
      orderCode: 'ORD-20240501-0001',
      userEmail: 'nguyen.van.an@gmail.com',
      shippingAddress: {
        fullName: 'Nguyễn Văn An',
        phone: '0912345678',
        address: '45 Lê Lợi',
        ward: 'Phường Bến Nghé',
        district: 'Quận 1',
        city: 'TP.HCM',
      },
      shippingFee: 30000,
      discount: 0,
      status: OrderStatus.DELIVERED,
      note: 'Giao nhanh giúp tôi nhé',
      items: [
        {
          productSlug: 'samsung-galaxy-s24-ultra',
          variantLabel: '256GB - Titanium Black',
          unitPrice: 29990000,
          quantity: 1,
        },
        {
          productSlug: 'sony-wh-1000xm5',
          variantLabel: 'Đen',
          unitPrice: 7490000,
          quantity: 1,
        },
      ],
      payment: {
        method: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.SUCCESS,
        transactionId: 'VCB20240501123456',
        metadata: {
          bank: 'Vietcombank',
          accountName: 'NGUYEN VAN AN',
          transferNote: 'ORD-20240501-0001',
        },
      },
      createdDaysAgo: 20,
    },

    // ── Đơn 2: đang vận chuyển, thanh toán MoMo ──
    {
      orderCode: 'ORD-20240505-0002',
      userEmail: 'tran.thi.bich@gmail.com',
      shippingAddress: {
        fullName: 'Trần Thị Bích',
        phone: '0987654321',
        address: '88 Nguyễn Huệ',
        ward: 'Phường Bến Nghé',
        district: 'Quận 1',
        city: 'TP.HCM',
      },
      shippingFee: 0,
      discount: 500000,
      status: OrderStatus.SHIPPING,
      note: undefined, // ✅
      items: [
        {
          productSlug: 'apple-airpods-pro-2',
          variantLabel: undefined,
          unitPrice: 5990000,
          quantity: 1,
        }, // ✅
        {
          productSlug: 'apple-watch-series-9-45mm',
          variantLabel: '45mm Nhôm - Midnight',
          unitPrice: 11490000,
          quantity: 1,
        },
      ],
      payment: {
        method: PaymentMethod.MOMO,
        status: PaymentStatus.SUCCESS,
        transactionId: 'MOMO20240505987654',
        metadata: { momoOrderId: 'MM20240505987654', requestId: 'req-abc123' },
      },
      createdDaysAgo: 3,
    },

    // ── Đơn 3: đã xác nhận, thanh toán VNPay ──
    {
      orderCode: 'ORD-20240507-0003',
      userEmail: 'le.minh.cuong@gmail.com',
      shippingAddress: {
        fullName: 'Lê Minh Cường',
        phone: '0933445566',
        address: '12 Trần Hưng Đạo',
        ward: 'Phường Phạm Ngũ Lão',
        district: 'Quận 1',
        city: 'TP.HCM',
      },
      shippingFee: 0,
      discount: 3000000,
      status: OrderStatus.CONFIRMED,
      note: 'Đóng gói cẩn thận',
      items: [
        {
          productSlug: 'macbook-pro-16-m3-pro',
          variantLabel: '18GB / 512GB - Bạc',
          unitPrice: 66990000,
          quantity: 1,
        },
      ],
      payment: {
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.SUCCESS,
        transactionId: 'VNPAY20240507001122',
        metadata: {
          vnp_TxnRef: 'ORD-20240507-0003',
          vnp_BankCode: 'VCB',
          vnp_CardType: 'ATM',
        },
      },
      createdDaysAgo: 1,
    },

    // ── Đơn 4: chờ xử lý, thanh toán COD ──
    {
      orderCode: 'ORD-20240508-0004',
      userEmail: 'nguyen.van.an@gmail.com',
      shippingAddress: {
        fullName: 'Nguyễn Văn An',
        phone: '0912345678',
        address: '45 Lê Lợi',
        ward: 'Phường Bến Nghé',
        district: 'Quận 1',
        city: 'TP.HCM',
      },
      shippingFee: 30000,
      discount: 0,
      status: OrderStatus.PENDING,
      note: undefined, // ✅
      items: [
        {
          productSlug: 'sony-wh-1000xm5',
          variantLabel: 'Đen',
          unitPrice: 7490000,
          quantity: 1,
        },
      ],
      payment: {
        method: PaymentMethod.COD,
        status: PaymentStatus.PENDING,
        transactionId: undefined,
        metadata: { note: 'Thu tiền khi giao hàng' },
      }, // ✅
      createdDaysAgo: 0,
    },

    // ── Đơn 5: đã hủy, thanh toán MoMo refunded ──
    {
      orderCode: 'ORD-20240420-0005',
      userEmail: 'tran.thi.bich@gmail.com',
      shippingAddress: {
        fullName: 'Trần Thị Bích',
        phone: '0987654321',
        address: '88 Nguyễn Huệ',
        ward: 'Phường Bến Nghé',
        district: 'Quận 1',
        city: 'TP.HCM',
      },
      shippingFee: 30000,
      discount: 0,
      status: OrderStatus.CANCELLED,
      note: 'Khách hủy vì đổi ý',
      items: [
        {
          productSlug: 'ipad-pro-11-m4-wifi',
          variantLabel: '256GB Wi-Fi - Bạc',
          unitPrice: 22490000,
          quantity: 1,
        },
      ],
      payment: {
        method: PaymentMethod.MOMO,
        status: PaymentStatus.REFUNDED,
        transactionId: 'MOMO20240420-REF001',
        metadata: { refundId: 'REF-20240422-001', reason: 'Khách hủy đơn' },
      },
      createdDaysAgo: 35,
    },
  ];

  for (const seed of orders) {
    const existing = await orderRepo.findOneBy({ orderCode: seed.orderCode });
    if (existing) {
      console.log(`  [orders] — Skipped (đã tồn tại): ${seed.orderCode}`);
      continue;
    }

    // Tìm user
    const user = await userRepo.findOneBy({ email: seed.userEmail });
    if (!user) {
      console.warn(
        `  [orders] ⚠ User không tìm thấy: ${seed.userEmail} — bỏ qua ${seed.orderCode}`,
      );
      continue;
    }

    // Tính subtotal từ items
    let subtotal = 0;
    for (const it of seed.items) {
      subtotal += it.unitPrice * it.quantity;
    }
    const total = subtotal + seed.shippingFee - seed.discount;

    // Tạo Order
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - seed.createdDaysAgo);

    const order = orderRepo.create({
      orderCode: seed.orderCode,
      userId: user.id,
      shippingAddress: seed.shippingAddress,
      subtotal,
      shippingFee: seed.shippingFee,
      discount: seed.discount,
      total,
      status: seed.status,
      note: seed.note, // ✅ undefined — TypeORM sẽ bỏ qua hoặc lưu NULL vào DB
      createdAt,
      updatedAt: createdAt,
    });
    const savedOrder = await orderRepo.save(order);

    // Tạo OrderItems
    for (const it of seed.items) {
      const product = await productRepo.findOneBy({ slug: it.productSlug });
      if (!product) {
        console.warn(`  [orders] ⚠ Product không tìm thấy: ${it.productSlug}`);
        continue;
      }

      const orderItem = itemRepo.create({
        orderId: savedOrder.id,
        productId: product.id,
        productName: product.name,
        productImage: product.images?.[0]?.url ?? undefined, // ✅ undefined thay vì null
        variantLabel: it.variantLabel, // ✅ undefined thay vì null
        unitPrice: it.unitPrice,
        quantity: it.quantity,
        subtotal: it.unitPrice * it.quantity,
        createdAt,
      });
      await itemRepo.save(orderItem);
    }

    // Tạo Payment
    const payment = paymentRepo.create({
      orderId: savedOrder.id,
      method: seed.payment.method,
      status: seed.payment.status,
      amount: total,
      transactionId: seed.payment.transactionId, // ✅ undefined thay vì null
      metadata: seed.payment.metadata,
      createdAt,
      updatedAt: createdAt,
    });
    await paymentRepo.save(payment);

    console.log(`  [orders] ✔ Inserted: ${seed.orderCode} (${seed.status})`);
  }
}
