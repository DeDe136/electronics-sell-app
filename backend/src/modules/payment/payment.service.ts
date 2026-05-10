// payment.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentMethod, PaymentStatus } from './entities/payment.entity';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @ApiProperty({ example: 'uuid-order-id', description: 'UUID của đơn hàng cần thanh toán' })
  @IsUUID()
  orderId: string;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.VNPAY,
    description: 'Phương thức thanh toán: cod | bank_transfer | momo | vnpay',
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ example: 30020000, description: 'Số tiền cần thanh toán (VNĐ)', minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
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

  async getById(id: string): Promise<Payment> {
    return this.paymentRepo.findOneOrFail({ where: { id } });
  }

  async updateStatus(id: string, status: string, transactionId?: string, note?: string): Promise<Payment> {
    const payment = await this.getById(id);
    payment.status = status as PaymentStatus;
    if (transactionId) {
      payment.transactionId = transactionId;
    }
    if (note) {
      payment.metadata = { ...(payment.metadata || {}), note };
    }
    return this.paymentRepo.save(payment);
  }

  async deletePayment(id: string): Promise<void> {
    const payment = await this.getById(id);
    if (payment.status !== PaymentStatus.FAILED) {
      throw new BadRequestException('Only failed payments can be deleted');
    }
    await this.paymentRepo.remove(payment);
  }
}