import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CartService } from './cart.service';
import { CartItem } from './entities/cart-item.entity';

describe('CartService', () => {
  let service: CartService;
  let cartRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    delete: jest.Mock;
  };

  const buildItem = (overrides: Partial<CartItem> = {}): CartItem =>
    ({
      id: 'item-1',
      userId: 'user-1',
      productId: 'product-1',
      variantId: null,
      quantity: 2,
      product: { price: 100000, salePrice: null },
      ...overrides,
    }) as unknown as CartItem;

  beforeEach(async () => {
    cartRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (item) => item),
      remove: jest.fn(async (item) => item),
      delete: jest.fn(async () => ({ affected: 1 })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: getRepositoryToken(CartItem), useValue: cartRepo },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  describe('getCart', () => {
    it('computes subtotal using salePrice when available', async () => {
      cartRepo.find.mockResolvedValue([
        buildItem({
          quantity: 2,
          product: { price: 100000, salePrice: 80000 } as any,
        }),
        buildItem({
          id: 'item-2',
          quantity: 1,
          product: { price: 50000, salePrice: null } as any,
        }),
      ]);

      const result = await service.getCart('user-1');

      expect(result.subtotal).toBe(80000 * 2 + 50000);
      expect(result.itemCount).toBe(2);
      expect(cartRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
      });
    });

    it('returns an empty cart when there are no items', async () => {
      cartRepo.find.mockResolvedValue([]);

      const result = await service.getCart('user-1');

      expect(result).toEqual({ items: [], subtotal: 0, itemCount: 0 });
    });
  });

  describe('addItem', () => {
    it('throws BadRequestException when quantity is less than 1', async () => {
      await expect(
        service.addItem('user-1', { productId: 'product-1', quantity: 0 }),
      ).rejects.toThrow(BadRequestException);

      expect(cartRepo.findOne).not.toHaveBeenCalled();
    });

    it('increments quantity when the item already exists in the cart', async () => {
      const existing = buildItem({ quantity: 3 });
      cartRepo.findOne.mockResolvedValue(existing);

      const result = await service.addItem('user-1', {
        productId: 'product-1',
        quantity: 2,
      });

      expect(result.quantity).toBe(5);
      expect(cartRepo.save).toHaveBeenCalledWith(existing);
    });

    it('creates a new cart item when it does not already exist', async () => {
      cartRepo.findOne.mockResolvedValue(null);

      await service.addItem('user-1', { productId: 'product-2', quantity: 1 });

      expect(cartRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        productId: 'product-2',
        quantity: 1,
      });
      expect(cartRepo.save).toHaveBeenCalled();
    });
  });

  describe('updateQuantity', () => {
    it('removes the item when the new quantity is below 1', async () => {
      const existing = buildItem();
      cartRepo.findOne.mockResolvedValue(existing);

      await service.updateQuantity('user-1', 'item-1', 0);

      expect(cartRepo.remove).toHaveBeenCalledWith(existing);
      expect(cartRepo.save).not.toHaveBeenCalled();
    });

    it('updates the quantity when it is valid', async () => {
      const existing = buildItem({ quantity: 1 });
      cartRepo.findOne.mockResolvedValue(existing);

      const result = (await service.updateQuantity(
        'user-1',
        'item-1',
        5,
      )) as CartItem;

      expect(result.quantity).toBe(5);
      expect(cartRepo.save).toHaveBeenCalledWith(existing);
    });

    it('throws NotFoundException when the item is not found', async () => {
      cartRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateQuantity('user-1', 'missing', 2),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeItem', () => {
    it('removes an existing cart item', async () => {
      const existing = buildItem();
      cartRepo.findOne.mockResolvedValue(existing);

      await service.removeItem('user-1', 'item-1');

      expect(cartRepo.remove).toHaveBeenCalledWith(existing);
    });

    it('throws NotFoundException when the item does not belong to the user', async () => {
      cartRepo.findOne.mockResolvedValue(null);

      await expect(service.removeItem('user-1', 'item-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('clearCart', () => {
    it('deletes all cart items for the user', async () => {
      await service.clearCart('user-1');

      expect(cartRepo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    });
  });

  describe('removeItems', () => {
    it('does nothing when itemIds is empty', async () => {
      await service.removeItems('user-1', []);

      expect(cartRepo.find).not.toHaveBeenCalled();
      expect(cartRepo.remove).not.toHaveBeenCalled();
    });

    it('removes only the matching items', async () => {
      const items = [
        buildItem({ id: 'a' }),
        buildItem({ id: 'b' }),
        buildItem({ id: 'c' }),
      ];
      cartRepo.find.mockResolvedValue(items);

      await service.removeItems('user-1', ['a', 'c']);

      expect(cartRepo.remove).toHaveBeenCalledWith([items[0], items[2]]);
    });

    it('does not call remove when no items match', async () => {
      cartRepo.find.mockResolvedValue([buildItem({ id: 'a' })]);

      await service.removeItems('user-1', ['does-not-exist']);

      expect(cartRepo.remove).not.toHaveBeenCalled();
    });
  });
});
