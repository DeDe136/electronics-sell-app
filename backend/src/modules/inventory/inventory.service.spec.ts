import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { Inventory } from './entities/inventory.entity';

describe('InventoryService', () => {
  let service: InventoryService;
  let inventoryRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    increment: jest.Mock;
  };

  beforeEach(async () => {
    inventoryRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (inv) => inv),
      increment: jest.fn(async () => undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(Inventory), useValue: inventoryRepo },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('getStock', () => {
    it('returns 0 when no inventory record exists', async () => {
      inventoryRepo.findOne.mockResolvedValue(null);

      const result = await service.getStock('product-1');

      expect(result).toBe(0);
      expect(inventoryRepo.findOne).toHaveBeenCalledWith({ where: { sku: 'product-1' } });
    });

    it('returns quantity minus reserved for a plain product', async () => {
      inventoryRepo.findOne.mockResolvedValue({ quantity: 10, reserved: 3 });

      const result = await service.getStock('product-1');

      expect(result).toBe(7);
    });

    it('builds a composite SKU when a variantId is provided', async () => {
      inventoryRepo.findOne.mockResolvedValue({ quantity: 5, reserved: 1 });

      const result = await service.getStock('product-1', 'variant-1');

      expect(result).toBe(4);
      expect(inventoryRepo.findOne).toHaveBeenCalledWith({
        where: { sku: 'product-1-variant-1' },
      });
    });
  });

  describe('setStock', () => {
    it('creates a new inventory record when none exists', async () => {
      inventoryRepo.findOne.mockResolvedValue(null);

      const result = await service.setStock('product-1', 20);

      expect(inventoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sku: 'product-1', productId: 'product-1' }),
      );
      expect(result.quantity).toBe(20);
      expect(inventoryRepo.save).toHaveBeenCalled();
    });

    it('updates the quantity on an existing inventory record', async () => {
      const existing = { sku: 'product-1', quantity: 5, reserved: 0 };
      inventoryRepo.findOne.mockResolvedValue(existing);

      const result = await service.setStock('product-1', 15);

      expect(inventoryRepo.create).not.toHaveBeenCalled();
      expect(result.quantity).toBe(15);
      expect(inventoryRepo.save).toHaveBeenCalledWith(existing);
    });
  });

  describe('adjustStock', () => {
    it('increments the quantity by the given delta', async () => {
      await service.adjustStock('product-1', -2, 'variant-1');

      expect(inventoryRepo.increment).toHaveBeenCalledWith(
        { sku: 'product-1-variant-1' },
        'quantity',
        -2,
      );
    });
  });
});
