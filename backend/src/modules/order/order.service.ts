// order.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CartService } from '../cart/cart.service';

export class CreateOrderDto {
  shippingAddress: {
    fullName: string;
    phone: string;
    address: string;
    ward: string;
    district: string;
    city: string;
  };
  note?: string;
}

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly itemRepo: Repository<OrderItem>,
    private readonly cartService: CartService,
    private readonly dataSource: DataSource,
  ) {}

  async createFromCart(userId: string, dto: CreateOrderDto): Promise<Order> {
    const cart = await this.cartService.getCart(userId);
    if (!cart.items.length) throw new BadRequestException('Cart is empty');

    const SHIPPING_FEE = 30000;

    return this.dataSource.transaction(async (em) => {
      const order = em.create(Order, {
        orderCode: this.generateOrderCode(),
        userId,
        shippingAddress: dto.shippingAddress,
        note: dto.note,
        subtotal: cart.subtotal,
        shippingFee: SHIPPING_FEE,
        discount: 0,
        total: cart.subtotal + SHIPPING_FEE,
        status: OrderStatus.PENDING,
      });
      const savedOrder = await em.save(Order, order);

      for (const item of cart.items) {
        const price = Number(item.product.salePrice || item.product.price);
        await em.save(OrderItem, {
          orderId: savedOrder.id,
          productId: item.productId,
          productName: item.product.name,
          productImage: item.product.images?.[0]?.url,
          variantLabel: item.variantId,
          unitPrice: price,
          quantity: item.quantity,
          subtotal: price * item.quantity,
        });
      }

      // Xóa giỏ hàng sau khi đặt thành công
      await this.cartService.clearCart(userId);
      return savedOrder;
    });
  }

  async getMyOrders(userId: string) {
    return this.orderRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getOrderDetail(userId: string, orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private generateOrderCode(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ORD-${date}-${rand}`;
  }
}
