import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrderService } from './order.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../payment/entities/payment.entity';
import { ProductVariant } from '../catalog/entities/product-variant.entity';
import { CartService } from '../cart/cart.service';

describe('OrderService', () => {
  let service: OrderService;
  let orderRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let itemRepo: Record<string, jest.Mock>;
  let paymentRepo: Record<string, jest.Mock>;
  let variantRepo: { findByIds: jest.Mock };
  let cartService: {
    getCart: jest.Mock;
    removeItem: jest.Mock;
    updateQuantity: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let entityManager: {
    create: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
  };

  beforeEach(async () => {
    orderRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (order) => order),
      remove: jest.fn(async (order) => order),
    };
    itemRepo = {};
    paymentRepo = {};
    variantRepo = { findByIds: jest.fn().mockResolvedValue([]) };
    cartService = {
      getCart: jest.fn(),
      removeItem: jest.fn(),
      updateQuantity: jest.fn(),
    };

    entityManager = {
      create: jest.fn((entity, data) => ({ ...data })),
      save: jest.fn(async (_entity, data) => ({ id: 'order-1', ...data })),
      findOneOrFail: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(async (cb) => cb(entityManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(OrderItem), useValue: itemRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(ProductVariant), useValue: variantRepo },
        { provide: CartService, useValue: cartService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  describe('createFromCart', () => {
    const cartItem = {
      id: 'cart-item-1',
      productId: 'product-1',
      variantId: null,
      quantity: 3,
      product: {
        name: 'Laptop',
        price: 1000000,
        salePrice: null,
        images: [],
        variants: [],
      },
    };

    it('throws BadRequestException when no items are provided', async () => {
      await expect(
        service.createFromCart('user-1', { items: [] } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when a cart item is not found', async () => {
      cartService.getCart.mockResolvedValue({
        items: [],
        subtotal: 0,
        itemCount: 0,
      });

      await expect(
        service.createFromCart('user-1', {
          items: [{ cartItemId: 'missing', quantity: 1 }],
          shippingAddress: {} as any,
          paymentMethod: PaymentMethod.COD,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the requested quantity exceeds the cart quantity', async () => {
      cartService.getCart.mockResolvedValue({
        items: [cartItem],
        subtotal: 0,
        itemCount: 1,
      });

      await expect(
        service.createFromCart('user-1', {
          items: [{ cartItemId: 'cart-item-1', quantity: 10 }],
          shippingAddress: {} as any,
          paymentMethod: PaymentMethod.COD,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates an order, marks COD payments as successful, and removes fully-ordered cart items', async () => {
      cartService.getCart.mockResolvedValue({
        items: [cartItem],
        subtotal: 0,
        itemCount: 1,
      });
      entityManager.findOneOrFail.mockResolvedValue({
        id: 'order-1',
        items: [],
        payment: {},
      });

      const result = await service.createFromCart('user-1', {
        items: [{ cartItemId: 'cart-item-1', quantity: 3 }],
        shippingAddress: { fullName: 'A' } as any,
        paymentMethod: PaymentMethod.COD,
      } as any);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(entityManager.save).toHaveBeenCalledWith(
        Order,
        expect.objectContaining({
          subtotal: 3000000,
          shippingFee: 30000,
          total: 3030000,
        }),
      );
      expect(entityManager.save).toHaveBeenCalledWith(
        Payment,
        expect.objectContaining({ status: PaymentStatus.SUCCESS }),
      );
      // Ordered the full cart quantity -> item should be removed, not just decremented
      expect(cartService.removeItem).toHaveBeenCalledWith(
        'user-1',
        'cart-item-1',
      );
      expect(cartService.updateQuantity).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'order-1', items: [], payment: {} });
    });

    it('decrements the cart quantity when only part of it is ordered', async () => {
      cartService.getCart.mockResolvedValue({
        items: [cartItem],
        subtotal: 0,
        itemCount: 1,
      });
      entityManager.findOneOrFail.mockResolvedValue({ id: 'order-1' });

      await service.createFromCart('user-1', {
        items: [{ cartItemId: 'cart-item-1', quantity: 1 }],
        shippingAddress: {} as any,
        paymentMethod: PaymentMethod.COD,
      } as any);

      expect(cartService.updateQuantity).toHaveBeenCalledWith(
        'user-1',
        'cart-item-1',
        2,
      );
      expect(cartService.removeItem).not.toHaveBeenCalled();
    });

    it('leaves non-COD payments pending', async () => {
      cartService.getCart.mockResolvedValue({
        items: [cartItem],
        subtotal: 0,
        itemCount: 1,
      });
      entityManager.findOneOrFail.mockResolvedValue({ id: 'order-1' });

      await service.createFromCart('user-1', {
        items: [{ cartItemId: 'cart-item-1', quantity: 3 }],
        shippingAddress: {} as any,
        paymentMethod: PaymentMethod.VNPAY,
      } as any);

      expect(entityManager.save).toHaveBeenCalledWith(
        Payment,
        expect.objectContaining({ status: PaymentStatus.PENDING }),
      );
    });
  });

  describe('getMyOrders', () => {
    it('returns orders for the given user sorted by newest first', async () => {
      orderRepo.find.mockResolvedValue([{ id: 'order-1' }]);

      const result = await service.getMyOrders('user-1');

      expect(orderRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([{ id: 'order-1' }]);
    });
  });

  describe('getOrderDetail', () => {
    it('throws NotFoundException when the order does not exist for the user', async () => {
      orderRepo.findOne.mockResolvedValue(null);

      await expect(service.getOrderDetail('user-1', 'order-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the order with items and payment relations', async () => {
      const order = { id: 'order-1', items: [], payment: {} };
      orderRepo.findOne.mockResolvedValue(order);

      const result = await service.getOrderDetail('user-1', 'order-1');

      expect(orderRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'order-1', userId: 'user-1' },
        relations: ['items', 'payment'],
      });
      expect(result).toBe(order);
    });
  });

  describe('cancelOrder', () => {
    it('throws NotFoundException when the order is not found', async () => {
      orderRepo.findOne.mockResolvedValue(null);

      await expect(service.cancelOrder('user-1', 'order-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('cancels a pending order', async () => {
      orderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
      });

      const result = await service.cancelOrder('user-1', 'order-1');

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(orderRepo.save).toHaveBeenCalled();
    });

    it('throws BadRequestException when the order is not cancellable', async () => {
      orderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.SHIPPING,
      });

      await expect(service.cancelOrder('user-1', 'order-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateOrderStatus', () => {
    it('throws BadRequestException for an invalid status', async () => {
      await expect(
        service.updateOrderStatus('order-1', 'not-a-real-status'),
      ).rejects.toThrow(BadRequestException);

      expect(orderRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the order does not exist', async () => {
      orderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateOrderStatus('order-1', OrderStatus.CONFIRMED),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates the order status and optional note', async () => {
      orderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
      });

      const result = await service.updateOrderStatus(
        'order-1',
        OrderStatus.CONFIRMED,
        'Confirmed by admin',
      );

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(result.note).toBe('Confirmed by admin');
    });
  });

  describe('deleteOrder', () => {
    it('throws NotFoundException when the order does not exist', async () => {
      orderRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteOrder('order-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the order is not in a deletable status', async () => {
      orderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
      });

      await expect(service.deleteOrder('order-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(orderRepo.remove).not.toHaveBeenCalled();
    });

    it('removes an order that is cancelled or refunded', async () => {
      const order = { id: 'order-1', status: OrderStatus.CANCELLED };
      orderRepo.findOne.mockResolvedValue(order);

      await service.deleteOrder('order-1');

      expect(orderRepo.remove).toHaveBeenCalledWith(order);
    });
  });
});
