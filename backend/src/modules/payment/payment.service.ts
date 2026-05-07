// payment.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentMethod, PaymentStatus } from './entities/payment.entity';

export class CreatePaymentDto {
  orderId: string;
  method: PaymentMethod;
  amount: number;
}

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  async initiate(dto: CreatePaymentDto): Promise<Payment> {
    const payment = this.paymentRepo.create({
      orderId: dto.orderId,
      method: dto.method,
      amount: dto.amount,
      status: PaymentStatus.PENDING,
    });
    const saved = await this.paymentRepo.save(payment);

    if (dto.method === PaymentMethod.COD) {
      // COD: tự động confirm ngay
      return this.confirm(saved.id, 'COD-' + saved.id);
    }

    // TODO: Tích hợp VNPay/MoMo SDK ở đây
    // Trả về paymentUrl để redirect frontend
    return saved;
  }

  async confirm(paymentId: string, transactionId: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOneOrFail({ where: { id: paymentId } });
    payment.status = PaymentStatus.SUCCESS;
    payment.transactionId = transactionId;
    return this.paymentRepo.save(payment);
  }

  async getByOrder(orderId: string): Promise<Payment[]> {
    return this.paymentRepo.find({ where: { orderId }, order: { createdAt: 'DESC' } });
  }
}
