import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { PaymentMethodOption } from './entities/payment-method-option.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, PaymentMethodOption])],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}