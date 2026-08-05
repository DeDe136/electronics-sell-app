import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from './entities/payment.entity';
import { PaymentMethodOption } from './entities/payment-method-option.entity';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepo: Record<string, jest.Mock>;
  let methodOptionRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    paymentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (p) => ({ id: 'payment-1', ...p })),
      remove: jest.fn(async (p) => p),
    };
    methodOptionRepo = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        {
          provide: getRepositoryToken(PaymentMethodOption),
          useValue: methodOptionRepo,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('getPaymentMethods', () => {
    it('returns active payment methods sorted by sortOrder', async () => {
      methodOptionRepo.find.mockResolvedValue([{ id: 'vnpay' }]);

      const result = await service.getPaymentMethods();

      expect(methodOptionRepo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { sortOrder: 'ASC' },
      });
      expect(result).toEqual([{ id: 'vnpay' }]);
    });
  });

  describe('initiate', () => {
    it('auto-confirms COD payments', async () => {
      paymentRepo.findOneOrFail.mockResolvedValue({
        id: 'payment-1',
        status: PaymentStatus.PENDING,
      });

      const result = await service.initiate({
        orderId: 'order-1',
        method: PaymentMethod.COD,
        amount: 100000,
      });

      expect(result.status).toBe(PaymentStatus.SUCCESS);
      expect(result.transactionId).toBe('COD-payment-1');
    });

    it('leaves non-COD payments pending', async () => {
      const result = await service.initiate({
        orderId: 'order-1',
        method: PaymentMethod.VNPAY,
        amount: 100000,
      });

      expect(result.status).toBe(PaymentStatus.PENDING);
    });
  });

  describe('confirm', () => {
    it('marks the payment as successful with the given transaction id', async () => {
      paymentRepo.findOneOrFail.mockResolvedValue({
        id: 'payment-1',
        status: PaymentStatus.PENDING,
      });

      const result = await service.confirm('payment-1', 'TXN-123');

      expect(result.status).toBe(PaymentStatus.SUCCESS);
      expect(result.transactionId).toBe('TXN-123');
    });
  });

  describe('updateStatus', () => {
    it('updates status, transactionId, and merges metadata note', async () => {
      paymentRepo.findOneOrFail.mockResolvedValue({
        id: 'payment-1',
        status: PaymentStatus.PENDING,
        metadata: { existing: true },
      });

      const result = await service.updateStatus(
        'payment-1',
        PaymentStatus.FAILED,
        'TXN-999',
        'Insufficient funds',
      );

      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.transactionId).toBe('TXN-999');
      expect(result.metadata).toEqual({
        existing: true,
        note: 'Insufficient funds',
      });
    });
  });

  describe('deletePayment', () => {
    it('throws BadRequestException when the payment is not failed', async () => {
      paymentRepo.findOneOrFail.mockResolvedValue({
        id: 'payment-1',
        status: PaymentStatus.SUCCESS,
      });

      await expect(service.deletePayment('payment-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(paymentRepo.remove).not.toHaveBeenCalled();
    });

    it('removes the payment when it has failed', async () => {
      const payment = { id: 'payment-1', status: PaymentStatus.FAILED };
      paymentRepo.findOneOrFail.mockResolvedValue(payment);

      await service.deletePayment('payment-1');

      expect(paymentRepo.remove).toHaveBeenCalledWith(payment);
    });
  });
});
