import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Between } from 'typeorm';
import { Product } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto, SortOrder } from './dto/product-query.dto';
import { StorageService } from '../storage/storage.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    private readonly storageService: StorageService,
  ) {}

  async findAll(query: ProductQueryDto) {
    const { search, categoryId, brand, minPrice, maxPrice, specs, sort } = query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.productRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category')
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
      case SortOrder.PRICE_ASC: qb.orderBy('p.price', 'ASC'); break;
      case SortOrder.PRICE_DESC: qb.orderBy('p.price', 'DESC'); break;
      case SortOrder.POPULAR: qb.orderBy('p.soldCount', 'DESC'); break;
      default: qb.orderBy('p.createdAt', 'DESC');
    }

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { slug } });
    if (!product) throw new NotFoundException(`Product "${slug}" not found`);

    // Tăng view count
    await this.productRepo.increment({ id: product.id }, 'viewCount', 1);
    return product;
  }

  async findById(id: string): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Product not found`);
    return product;
  }

  async create(
    dto: CreateProductDto,
    images?: Express.Multer.File[],
  ): Promise<Product> {
    const slug = this.generateSlug(dto.name);
    const existing = await this.productRepo.findOne({ where: { slug } });
    if (existing) throw new ConflictException('Product slug already exists');

    let uploadedImages: { url: string; key: string }[] = [];
    if (images?.length) {
      const results = await this.storageService.uploadFiles(images, 'products');
      uploadedImages = results.map((r) => ({ url: r.url, key: r.key }));
    }

    const product = this.productRepo.create({
      ...dto,
      slug,
      images: uploadedImages,
      variants: dto.variants?.map((v) => ({ ...v, id: uuidv4() })) || [],
    });

    return this.productRepo.save(product);
  }

  async update(
    id: string,
    dto: Partial<CreateProductDto>,
    images?: Express.Multer.File[],
  ): Promise<Product> {
    const product = await this.findById(id);

    if (images?.length) {
      const results = await this.storageService.uploadFiles(images, 'products');
      const newImages = results.map((r) => ({ url: r.url, key: r.key }));
      product.images = [...product.images, ...newImages];
    }

    Object.assign(product, dto);
    return this.productRepo.save(product);
  }

  async delete(id: string): Promise<void> {
    const product = await this.findById(id);
    // Xóa ảnh trên S3
    for (const img of product.images) {
      await this.storageService.deleteFile(img.key);
    }
    await this.productRepo.remove(product);
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
