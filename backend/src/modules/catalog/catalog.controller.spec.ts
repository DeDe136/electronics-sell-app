import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateVariantDto } from './dto/create-product.dto';

describe('CatalogController', () => {
  let controller: CatalogController;
  let catalogService: Record<string, jest.Mock>;

  beforeEach(() => {
    catalogService = {
      getCategories: jest.fn(),
      getCategoryById: jest.fn(),
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
      findAll: jest.fn(),
      findBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getVariants: jest.fn(),
      findVariant: jest.fn(),
      addVariant: jest.fn(),
      updateVariant: jest.fn(),
      deleteVariant: jest.fn(),
    };

    controller = new CatalogController(
      catalogService as unknown as CatalogService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ===========================
  //  GET /catalog/products
  //  Lưu ý: KHÔNG assert cứng vào field debug "_debugVersion" (chỉ dùng tạm
  //  để quan sát canary rollout, sẽ bị xoá trước khi lên production) — test
  //  chỉ xác nhận hành vi nghiệp vụ thật (gọi đúng service, trả đúng dữ
  //  liệu, không nuốt lỗi) để sau này xoá field debug thì không phải sửa
  //  lại test.
  // ===========================
  describe('findAll', () => {
    it('gọi catalogService.findAll với đúng query và trả về đúng "items"/"meta" nhận được', async () => {
      const query: ProductQueryDto = { page: 1, limit: 20 } as ProductQueryDto;
      const serviceResult = {
        items: [{ id: 'p1', name: 'iPhone 16' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      catalogService.findAll.mockResolvedValue(serviceResult);

      const result = await controller.findAll(query);

      expect(catalogService.findAll).toHaveBeenCalledWith(query);
      expect(result.items).toEqual(serviceResult.items);
      expect(result.meta).toEqual(serviceResult.meta);
    });

    it('vẫn giữ nguyên "items" rỗng và "meta" khi service không tìm thấy sản phẩm nào', async () => {
      const query: ProductQueryDto = {} as ProductQueryDto;
      const emptyResult = {
        items: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
      catalogService.findAll.mockResolvedValue(emptyResult);

      const result = await controller.findAll(query);

      expect(result.items).toEqual([]);
      expect(result.meta).toEqual(emptyResult.meta);
    });

    it('không nuốt lỗi: reject nếu catalogService.findAll ném lỗi', async () => {
      const query: ProductQueryDto = {} as ProductQueryDto;
      catalogService.findAll.mockRejectedValue(new Error('DB down'));

      await expect(controller.findAll(query)).rejects.toThrow('DB down');
    });
  });

  // ===========================
  //  Categories — Public
  // ===========================
  describe('getCategories', () => {
    it('trả về danh sách danh mục từ service', () => {
      const categories = [{ id: 'c1', name: 'Điện thoại' }];
      catalogService.getCategories.mockReturnValue(categories);

      expect(controller.getCategories()).toBe(categories);
      expect(catalogService.getCategories).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCategoryById', () => {
    it('gọi service với đúng id', () => {
      const category = { id: 'c1', name: 'Điện thoại' };
      catalogService.getCategoryById.mockReturnValue(category);

      const result = controller.getCategoryById('c1');

      expect(catalogService.getCategoryById).toHaveBeenCalledWith('c1');
      expect(result).toBe(category);
    });
  });

  // ===========================
  //  Categories — Admin
  // ===========================
  describe('createCategory', () => {
    it('chuyển tiếp dto sang service.createCategory', () => {
      const dto = { name: 'Laptop' };
      const created = { id: 'c2', ...dto };
      catalogService.createCategory.mockReturnValue(created);

      const result = controller.createCategory(dto);

      expect(catalogService.createCategory).toHaveBeenCalledWith(dto);
      expect(result).toBe(created);
    });
  });

  describe('updateCategory', () => {
    it('chuyển tiếp id và dto sang service.updateCategory', () => {
      const dto = { name: 'Laptop Gaming' };
      catalogService.updateCategory.mockReturnValue({ id: 'c2', ...dto });

      controller.updateCategory('c2', dto);

      expect(catalogService.updateCategory).toHaveBeenCalledWith('c2', dto);
    });
  });

  describe('deleteCategory', () => {
    it('chuyển tiếp id sang service.deleteCategory', () => {
      controller.deleteCategory('c2');

      expect(catalogService.deleteCategory).toHaveBeenCalledWith('c2');
    });
  });

  // ===========================
  //  Products
  // ===========================
  describe('findBySlug', () => {
    it('chuyển tiếp slug sang service.findBySlug', () => {
      const product = { id: 'p1', slug: 'samsung-galaxy-s24-ultra' };
      catalogService.findBySlug.mockReturnValue(product);

      const result = controller.findBySlug('samsung-galaxy-s24-ultra');

      expect(catalogService.findBySlug).toHaveBeenCalledWith(
        'samsung-galaxy-s24-ultra',
      );
      expect(result).toBe(product);
    });
  });

  describe('create', () => {
    it('chuyển tiếp dto và images sang service.create', () => {
      const dto = { name: 'iPhone 16' } as any;
      const images = [
        { originalname: 'a.png' },
      ] as unknown as Express.Multer.File[];
      catalogService.create.mockReturnValue({ id: 'p1' });

      controller.create(dto, images);

      expect(catalogService.create).toHaveBeenCalledWith(dto, images);
    });

    it('vẫn hoạt động khi không có ảnh nào được upload (images undefined)', () => {
      const dto = { name: 'iPhone 16' } as any;
      catalogService.create.mockReturnValue({ id: 'p1' });

      controller.create(dto, undefined);

      expect(catalogService.create).toHaveBeenCalledWith(dto, undefined);
    });
  });

  describe('update', () => {
    it('chuyển tiếp id, dto và images sang service.update', () => {
      const dto = { name: 'iPhone 16 (2024)' } as any;
      const images = [] as unknown as Express.Multer.File[];
      catalogService.update.mockReturnValue({ id: 'p1', ...dto });

      controller.update('p1', dto, images);

      expect(catalogService.update).toHaveBeenCalledWith('p1', dto, images);
    });
  });

  describe('delete', () => {
    it('chuyển tiếp id sang service.delete', () => {
      controller.delete('p1');

      expect(catalogService.delete).toHaveBeenCalledWith('p1');
    });
  });

  // ===========================
  //  Variants
  // ===========================
  describe('getVariants', () => {
    it('chuyển tiếp id sang service.getVariants', () => {
      const variants = [{ id: 'v1' }];
      catalogService.getVariants.mockReturnValue(variants);

      const result = controller.getVariants('p1');

      expect(catalogService.getVariants).toHaveBeenCalledWith('p1');
      expect(result).toBe(variants);
    });
  });

  describe('getVariantById', () => {
    it('chuyển tiếp variantId sang service.findVariant', () => {
      const variant = { id: 'v1' };
      catalogService.findVariant.mockReturnValue(variant);

      const result = controller.getVariantById('v1');

      expect(catalogService.findVariant).toHaveBeenCalledWith('v1');
      expect(result).toBe(variant);
    });
  });

  describe('addVariant', () => {
    it('chuyển tiếp id sản phẩm và dto sang service.addVariant', () => {
      const dto: CreateVariantDto = {
        label: '8GB/128GB',
        sku: 'SKU-001',
        price: 27990000,
      } as CreateVariantDto;
      catalogService.addVariant.mockReturnValue({ id: 'v1', ...dto });

      controller.addVariant('p1', dto);

      expect(catalogService.addVariant).toHaveBeenCalledWith('p1', dto);
    });
  });

  describe('updateVariant', () => {
    it('chuyển tiếp variantId và dto sang service.updateVariant', () => {
      const dto = { price: 25990000 };
      catalogService.updateVariant.mockReturnValue({ id: 'v1', ...dto });

      controller.updateVariant('v1', dto);

      expect(catalogService.updateVariant).toHaveBeenCalledWith('v1', dto);
    });
  });

  describe('deleteVariant', () => {
    it('chuyển tiếp variantId sang service.deleteVariant', () => {
      controller.deleteVariant('v1');

      expect(catalogService.deleteVariant).toHaveBeenCalledWith('v1');
    });
  });
});
