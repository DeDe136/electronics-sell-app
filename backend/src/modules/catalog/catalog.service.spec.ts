import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CatalogService } from './catalog.service';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { Category } from './entities/category.entity';
import { StorageService } from '../storage/storage.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let productRepo: Record<string, jest.Mock>;
  let variantRepo: Record<string, jest.Mock>;
  let categoryRepo: Record<string, jest.Mock>;
  let storageService: Record<string, jest.Mock>;

  beforeEach(async () => {
    productRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (p) => p),
      remove: jest.fn(async (p) => p),
      count: jest.fn(),
      increment: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    variantRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (v) => v),
      remove: jest.fn(async (v) => v),
      delete: jest.fn(),
    };
    categoryRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (c) => c),
      remove: jest.fn(async (c) => c),
    };
    storageService = {
      uploadFiles: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getRepositoryToken(ProductVariant), useValue: variantRepo },
        { provide: getRepositoryToken(Category), useValue: categoryRepo },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
  });

  describe('findBySlug', () => {
    it('throws NotFoundException when the product does not exist', async () => {
      productRepo.findOne.mockResolvedValue(null);

      await expect(service.findBySlug('missing-slug')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('increments the view count and returns the product', async () => {
      const product = { id: 'product-1', slug: 'iphone-16' };
      productRepo.findOne.mockResolvedValue(product);

      const result = await service.findBySlug('iphone-16');

      expect(productRepo.increment).toHaveBeenCalledWith(
        { id: 'product-1' },
        'viewCount',
        1,
      );
      expect(result).toBe(product);
    });
  });

  describe('findById', () => {
    it('throws NotFoundException when the product does not exist', async () => {
      productRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the product when found', async () => {
      const product = { id: 'product-1' };
      productRepo.findOne.mockResolvedValue(product);

      await expect(service.findById('product-1')).resolves.toBe(product);
    });
  });

  describe('create', () => {
    it('throws ConflictException when the generated slug already exists', async () => {
      productRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ name: 'iPhone 16 Pro Max', variants: [] } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('generates a URL-friendly, lowercase, hyphenated slug from the product name', async () => {
      productRepo.findOne.mockResolvedValue(null);

      await service.create({
        name: 'Dien thoai Samsung Galaxy S24',
        variants: [],
      } as any);

      expect(productRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'dien-thoai-samsung-galaxy-s24' }),
      );
    });

    it('uploads images when provided', async () => {
      productRepo.findOne.mockResolvedValue(null);
      storageService.uploadFiles.mockResolvedValue([
        { url: 'http://x/1.jpg', key: 'products/1.jpg' },
      ]);

      await service.create({ name: 'Laptop Dell', variants: [] } as any, [
        { originalname: '1.jpg' } as any,
      ]);

      expect(storageService.uploadFiles).toHaveBeenCalled();
      expect(productRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          images: [{ url: 'http://x/1.jpg', key: 'products/1.jpg' }],
        }),
      );
    });
  });

  describe('delete', () => {
    it('removes all product images from storage before deleting the product', async () => {
      const product = {
        id: 'product-1',
        images: [{ url: 'http://x/1.jpg', key: 'products/1.jpg' }],
      };
      productRepo.findOne.mockResolvedValue(product);

      await service.delete('product-1');

      expect(storageService.deleteFile).toHaveBeenCalledWith('products/1.jpg');
      expect(productRepo.remove).toHaveBeenCalledWith(product);
    });
  });

  describe('addVariant', () => {
    it('throws ConflictException when the SKU already exists', async () => {
      productRepo.findOne.mockResolvedValue({ id: 'product-1' });
      variantRepo.findOne.mockResolvedValue({ id: 'variant-1', sku: 'SKU-1' });

      await expect(
        service.addVariant('product-1', {
          label: '8/128',
          sku: 'SKU-1',
          price: 100,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates the variant when the SKU is unique', async () => {
      productRepo.findOne.mockResolvedValue({ id: 'product-1' });
      variantRepo.findOne.mockResolvedValue(null);

      await service.addVariant('product-1', {
        label: '8/128',
        sku: 'SKU-2',
        price: 100,
      });

      expect(variantRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sku: 'SKU-2', productId: 'product-1' }),
      );
      expect(variantRepo.save).toHaveBeenCalled();
    });
  });

  describe('createCategory', () => {
    it('throws ConflictException when the name already exists', async () => {
      categoryRepo.findOne.mockResolvedValueOnce({
        id: 'cat-1',
        name: 'Điện thoại',
      });

      await expect(
        service.createCategory({ name: 'Điện thoại' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when the slug already exists', async () => {
      categoryRepo.findOne
        .mockResolvedValueOnce(null) // name check
        .mockResolvedValueOnce({ id: 'cat-1', slug: 'dien-thoai' }); // slug check

      await expect(
        service.createCategory({ name: 'Điện thoại' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a category with a generated slug when none is provided', async () => {
      categoryRepo.findOne.mockResolvedValue(null);

      await service.createCategory({ name: 'Laptop Gaming' });

      expect(categoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Laptop Gaming',
          slug: 'laptop-gaming',
        }),
      );
    });
  });

  describe('deleteCategory', () => {
    it('throws NotFoundException when the category does not exist', async () => {
      categoryRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteCategory('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when the category still has products', async () => {
      categoryRepo.findOne.mockResolvedValue({ id: 'cat-1', name: 'Laptop' });
      productRepo.count.mockResolvedValue(3);

      await expect(service.deleteCategory('cat-1')).rejects.toThrow(
        ConflictException,
      );
      expect(categoryRepo.remove).not.toHaveBeenCalled();
    });

    it('removes the category when it has no products', async () => {
      const category = { id: 'cat-1', name: 'Laptop' };
      categoryRepo.findOne.mockResolvedValue(category);
      productRepo.count.mockResolvedValue(0);

      await service.deleteCategory('cat-1');

      expect(categoryRepo.remove).toHaveBeenCalledWith(category);
    });
  });
});
