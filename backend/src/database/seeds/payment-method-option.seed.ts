/**
 * Seed: payment_method_options
 *
 * Chèn 4 phương thức thanh toán mặc định vào bảng payment_method_options.
 * Trường `code` phải khớp với enum PaymentMethod trong payment.entity.ts:
 *   cod | bank_transfer | momo | vnpay
 *
 * Chạy thông qua run-seeds.ts hoặc độc lập:
 *   npx ts-node src/database/seeds/payment-method-option.seed.ts
 */

import { DataSource } from 'typeorm';
import { PaymentMethodOption } from '../../modules/payment/entities/payment-method-option.entity';

const PAYMENT_METHODS = [
  {
    code: 'cod',
    name: 'Thanh toán khi nhận hàng (COD)',
    description: 'Trả tiền mặt khi nhận hàng, miễn phí',
    icon: '💵',
    isActive: true,
    sortOrder: 1,
    metadata: {
      note: 'Nhân viên giao hàng sẽ thu tiền mặt khi giao',
      surcharge: 0,
    },
  },
  {
    code: 'bank_transfer',
    name: 'Chuyển khoản ngân hàng',
    description: 'Chuyển khoản trước, đơn hàng xử lý sau khi xác nhận',
    icon: '🏦',
    isActive: true,
    sortOrder: 2,
    metadata: {
      bankName: 'Vietcombank',
      accountNumber: '1234567890',
      accountName: 'TECHSHOP VN',
      branch: 'Chi nhánh TP.HCM',
      note: 'Ghi nội dung: Họ tên + Số điện thoại của bạn',
    },
  },
  {
    code: 'momo',
    name: 'Ví MoMo',
    description: 'Thanh toán qua ví điện tử MoMo',
    icon: '💜',
    isActive: true,
    sortOrder: 3,
    metadata: {
      phoneNumber: '0909123456',
      accountName: 'TECHSHOP VN',
      note: 'Quét mã QR hoặc chuyển đến số điện thoại trên',
    },
  },
  {
    code: 'vnpay',
    name: 'VNPay',
    description: 'Thanh toán qua cổng VNPay (ATM, Visa, MasterCard, QR)',
    icon: '💳',
    isActive: true,
    sortOrder: 4,
    metadata: {
      supportedCards: ['ATM nội địa', 'Visa', 'MasterCard', 'JCB', 'QR Code'],
      note: 'Hỗ trợ hầu hết ngân hàng tại Việt Nam',
    },
  },
];

export async function seedPaymentMethodOptions(dataSource: DataSource) {
  const repo = dataSource.getRepository(PaymentMethodOption);

  console.log('  💳 Seeding payment_method_options...');

  for (const item of PAYMENT_METHODS) {
    const existing = await repo.findOne({ where: { code: item.code } });
    if (existing) {
      console.log(`    ↩  Bỏ qua (đã tồn tại): ${item.code}`);
      continue;
    }

    const record = repo.create(item);
    await repo.save(record);
    console.log(`    ✅ Đã thêm: ${item.code} — ${item.name}`);
  }

  console.log('  ✔  payment_method_options seed xong\n');
}