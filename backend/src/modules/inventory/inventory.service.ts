import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inventory } from './entities/inventory.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
  ) {}

  async getStock(productId: string, variantId?: string) {
    const sku = variantId ? `${productId}-${variantId}` : productId;
    const inv = await this.inventoryRepo.findOne({ where: { sku } });
    return inv ? inv.quantity - inv.reserved : 0;
  }

  async setStock(productId: string, quantity: number, variantId?: string) {
    const sku = variantId ? `${productId}-${variantId}` : productId;
    let inv = await this.inventoryRepo.findOne({ where: { sku } });
    if (!inv) {
      inv = this.inventoryRepo.create({ sku, productId, variantId });
    }
    inv.quantity = quantity;
    return this.inventoryRepo.save(inv);
  }

  async adjustStock(productId: string, delta: number, variantId?: string) {
    const sku = variantId ? `${productId}-${variantId}` : productId;
    await this.inventoryRepo.increment({ sku }, 'quantity', delta);
  }
}
