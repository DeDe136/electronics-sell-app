import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { Category } from './entities/category.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto, SortOrder } from './dto/product-query.dto';
import { StorageService } from '../storage/storage.service';

// eslint-disable-next-line @typescript-eslint/no-namespace
type MulterFile = Express.Multer.File;

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    private readonly storageService: StorageService,
  ) {}

  // ===========================
  //  Products
  // ===========================

  async findAll(query: ProductQueryDto) {
    const { search, categoryId, brand, minPrice, maxPrice, specs, sort } =
      query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.variants', 'variants')
      .where('p.status = :status', { status: 'active' });

    if (search) {
      qb.andWhere('(p.name ILIKE :s OR p.brand ILIKE :s)', {
        s: `%${search}%`,
      });
    }
    if (categoryId) qb.andWhere('p.categoryId = :categoryId', { categoryId });
    if (brand) qb.andWhere('p.brand ILIKE :brand', { brand: `%${brand}%` });
    if (minPrice) qb.andWhere('p.price >= :minPrice', { minPrice });
    if (maxPrice) qb.andWhere('p.price <= :maxPrice', { maxPrice });

    // Filter theo JSONB specs: WHERE specs->>'ram' = '8GB'
    if (specs) {
      Object.entries(specs).forEach(([key, value]) => {
        qb.andWhere(`p.specs->>'${key}' = :${key}`, { [key]: value });
      });
    }

    switch (sort) {
      case SortOrder.PRICE_ASC:
        qb.orderBy('p.price', 'ASC');
        break;
      case SortOrder.PRICE_DESC:
        qb.orderBy('p.price', 'DESC');
        break;
      case SortOrder.POPULAR:
        qb.orderBy('p.soldCount', 'DESC');
        break;
      default:
        qb.orderBy('p.createdAt', 'DESC');
    }

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { slug },
      relations: ['variants'],
    });
    if (!product) throw new NotFoundException(`Product "${slug}" not found`);

    // Tăng view count
    await this.productRepo.increment({ id: product.id }, 'viewCount', 1);
    return product;
  }

  async findById(id: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['variants'],
    });
    if (!product) throw new NotFoundException(`Product not found`);
    return product;
  }

  async create(dto: CreateProductDto, images?: MulterFile[]): Promise<Product> {
    const slug = this.generateSlug(dto.name);
    const existing = await this.productRepo.findOne({ where: { slug } });
    if (existing) throw new ConflictException('Product slug already exists');

    let uploadedImages: { url: string; key: string }[] = [];
    if (images?.length) {
      const results = await this.storageService.uploadFiles(images, 'products');
      uploadedImages = results.map((r) => ({ url: r.url, key: r.key }));
    }

    // Tạo các variant entity (cascade insert qua product)
    const variants: ProductVariant[] = (dto.variants ?? []).map((v) => {
      return this.variantRepo.create({
        label: v.label,
        sku: v.sku,
        price: v.price,
        specs: v.specs ?? {},
      });
    });

    const product = this.productRepo.create({
      ...dto,
      slug,
      images: uploadedImages,
      variants,
    });

    return this.productRepo.save(product);
  }

  async update(
    id: string,
    dto: Partial<CreateProductDto>,
    images?: MulterFile[],
  ): Promise<Product> {
    const product = await this.findById(id);

    if (images?.length) {
      const results = await this.storageService.uploadFiles(images, 'products');
      const newImages = results.map((r) => ({ url: r.url, key: r.key }));
      product.images = [...product.images, ...newImages];
    }

    // Nếu có variants mới → replace toàn bộ (xóa cũ, thêm mới)
    if (dto.variants !== undefined) {
      await this.variantRepo.delete({ productId: id });
      product.variants = (dto.variants ?? []).map((v) =>
        this.variantRepo.create({
          label: v.label,
          sku: v.sku,
          price: v.price,
          specs: v.specs ?? {},
          productId: id,
        }),
      );
    }

    const { variants: _variants, ...rest } = dto;
    _variants; // tránh warning unused variable
    Object.assign(product, rest);

    return this.productRepo.save(product);
  }

  async delete(id: string): Promise<void> {
    const product = await this.findById(id);
    // Xóa ảnh trên S3
    for (const img of product.images) {
      await this.storageService.deleteFile(img.key);
    }
    // Variants sẽ bị cascade delete
    await this.productRepo.remove(product);
  }

  // ===========================
  //  Variants CRUD
  // ===========================

  async getVariants(productId: string): Promise<ProductVariant[]> {
    await this.findById(productId); // đảm bảo product tồn tại
    return this.variantRepo.find({
      where: { productId },
      order: { createdAt: 'ASC' },
    });
  }

  async findVariant(variantId: string): Promise<ProductVariant> {
    const variant = await this.variantRepo.findOne({
      where: { id: variantId },
    });
    if (!variant) throw new NotFoundException(`Variant not found`);
    return variant;
  }

  async addVariant(
    productId: string,
    variantDto: {
      label: string;
      sku: string;
      price: number;
      specs?: Record<string, string>;
    },
  ): Promise<ProductVariant> {
    await this.findById(productId); // đảm bảo product tồn tại

    // Kiểm tra SKU trùng
    const existingSku = await this.variantRepo.findOne({
      where: { sku: variantDto.sku },
    });
    if (existingSku)
      throw new ConflictException(`SKU "${variantDto.sku}" already exists`);

    const variant = this.variantRepo.create({ ...variantDto, productId });
    return this.variantRepo.save(variant);
  }

  async updateVariant(
    variantId: string,
    variantDto: Partial<{
      label: string;
      sku: string;
      price: number;
      specs: Record<string, string>;
    }>,
  ): Promise<ProductVariant> {
    const variant = await this.findVariant(variantId);

    // Kiểm tra SKU trùng nếu có thay đổi SKU
    if (variantDto.sku && variantDto.sku !== variant.sku) {
      const existingSku = await this.variantRepo.findOne({
        where: { sku: variantDto.sku },
      });
      if (existingSku)
        throw new ConflictException(`SKU "${variantDto.sku}" already exists`);
    }

    Object.assign(variant, variantDto);
    return this.variantRepo.save(variant);
  }

  async deleteVariant(variantId: string): Promise<void> {
    const variant = await this.findVariant(variantId);
    await this.variantRepo.remove(variant);
  }

  // ===========================
  //  Categories CRUD
  // ===========================

  async getCategories(): Promise<Category[]> {
    return this.categoryRepo.find({ order: { name: 'ASC' } });
  }

  async getCategoryById(id: string): Promise<Category> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException(`Category not found`);
    return category;
  }

  async createCategory(dto: {
    name: string;
    slug?: string;
    iconUrl?: string;
    specFields?: string[];
  }): Promise<Category> {
    const slug = dto.slug ?? this.generateSlug(dto.name);

    // Kiểm tra trùng name hoặc slug
    const existingName = await this.categoryRepo.findOne({
      where: { name: dto.name },
    });
    if (existingName)
      throw new ConflictException(`Category name "${dto.name}" already exists`);

    const existingSlug = await this.categoryRepo.findOne({ where: { slug } });
    if (existingSlug)
      throw new ConflictException(`Category slug "${slug}" already exists`);

    const category = this.categoryRepo.create({
      name: dto.name,
      slug,
      iconUrl: dto.iconUrl ?? null,
      specFields: dto.specFields ?? [],
    });

    return this.categoryRepo.save(category);
  }

  async updateCategory(
    id: string,
    dto: {
      name?: string;
      slug?: string;
      iconUrl?: string;
      specFields?: string[];
    },
  ): Promise<Category> {
    const category = await this.getCategoryById(id);

    // Kiểm tra trùng name nếu có thay đổi
    if (dto.name && dto.name !== category.name) {
      const existing = await this.categoryRepo.findOne({
        where: { name: dto.name },
      });
      if (existing)
        throw new ConflictException(
          `Category name "${dto.name}" already exists`,
        );
    }

    // Kiểm tra trùng slug nếu có thay đổi
    if (dto.slug && dto.slug !== category.slug) {
      const existing = await this.categoryRepo.findOne({
        where: { slug: dto.slug },
      });
      if (existing)
        throw new ConflictException(
          `Category slug "${dto.slug}" already exists`,
        );
    }

    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.getCategoryById(id);

    // Kiểm tra còn sản phẩm không (RESTRICT constraint)
    const productCount = await this.productRepo.count({
      where: { categoryId: id },
    });
    if (productCount > 0) {
      throw new ConflictException(
        `Cannot delete category: it still has ${productCount} product(s). Move or delete them first.`,
      );
    }

    await this.categoryRepo.remove(category);
  }

  // ===========================
  //  Helpers
  // ===========================

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }
}
