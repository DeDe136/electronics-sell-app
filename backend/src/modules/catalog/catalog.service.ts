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

  async findAll(query: ProductQueryDto) {
    const { search, categoryId, brand, minPrice, maxPrice, specs, sort } = query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.variants', 'variants')
      .where('p.status = :status', { status: 'active' });

    if (search) {
      qb.andWhere('(p.name ILIKE :s OR p.brand ILIKE :s)', { s: `%${search}%` });
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

  async create(
    dto: CreateProductDto,
    images?: MulterFile[],
  ): Promise<Product> {
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

  // === Variants CRUD riêng ===

  async findVariant(variantId: string): Promise<ProductVariant> {
    const variant = await this.variantRepo.findOne({ where: { id: variantId } });
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
    Object.assign(variant, variantDto);
    return this.variantRepo.save(variant);
  }

  async deleteVariant(variantId: string): Promise<void> {
    const variant = await this.findVariant(variantId);
    await this.variantRepo.remove(variant);
  }

  // === Categories ===
  async getCategories(): Promise<Category[]> {
    return this.categoryRepo.find();
  }

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