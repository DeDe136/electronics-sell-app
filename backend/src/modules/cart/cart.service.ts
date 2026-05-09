import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CartItem } from './entities/cart-item.entity';
import { IsUUID, IsInt, IsOptional, Min } from 'class-validator';

export class AddToCartDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsUUID()
  @IsOptional()
  variantId?: string;
}

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private readonly cartRepo: Repository<CartItem>,
  ) {}

  async getCart(userId: string) {
    const items = await this.cartRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const subtotal = items.reduce((sum, item) => {
      const price = item.product.salePrice || item.product.price;
      return sum + Number(price) * item.quantity;
    }, 0);

    return { items, subtotal, itemCount: items.length };
  }

  async addItem(userId: string, dto: AddToCartDto): Promise<CartItem> {
    if (dto.quantity < 1) throw new BadRequestException('Quantity must be >= 1');

    // Nếu đã có item, tăng quantity
    const existing = await this.cartRepo.findOne({
      where: { userId, productId: dto.productId, variantId: dto.variantId ?? IsNull() },
    });

    if (existing) {
      existing.quantity += dto.quantity;
      return this.cartRepo.save(existing);
    }

    return this.cartRepo.save(
      this.cartRepo.create({ userId, ...dto }),
    );
  }

  async updateQuantity(userId: string, itemId: string, quantity: number) {
    if (quantity < 1) return this.removeItem(userId, itemId);
    const item = await this.findItem(userId, itemId);
    item.quantity = quantity;
    return this.cartRepo.save(item);
  }

  async removeItem(userId: string, itemId: string): Promise<void> {
    const item = await this.findItem(userId, itemId);
    await this.cartRepo.remove(item);
  }

  async clearCart(userId: string): Promise<void> {
    await this.cartRepo.delete({ userId });
  }

  private async findItem(userId: string, itemId: string): Promise<CartItem> {
    const item = await this.cartRepo.findOne({ where: { id: itemId, userId } });
    if (!item) throw new NotFoundException('Cart item not found');
    return item;
  }
}