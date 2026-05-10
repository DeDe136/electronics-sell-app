// order.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CartService } from '../cart/cart.service';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ShippingAddressDto {
  @ApiProperty({ example: 'Nguyen Van A', description: 'Họ tên người nhận' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: '0901234567', description: 'Số điện thoại người nhận' })
  @IsString()
  phone: string;

  @ApiProperty({ example: '123 Nguyen Trai', description: 'Số nhà, tên đường' })
  @IsString()
  address: string;

  @ApiProperty({ example: 'Phuong 2', description: 'Phường/Xã' })
  @IsString()
  ward: string;

  @ApiProperty({ example: 'Quan 5', description: 'Quận/Huyện' })
  @IsString()
  district: string;

  @ApiProperty({ example: 'Ho Chi Minh', description: 'Tỉnh/Thành phố' })
  @IsString()
  city: string;
}

export class CreateOrderDto {
  @ApiProperty({ type: ShippingAddressDto, description: 'Địa chỉ giao hàng' })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @ApiPropertyOptional({
    example: 'Giao giờ hành chính, gọi trước 30 phút',
    description: 'Ghi chú thêm cho đơn hàng',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

/** Các trạng thái được phép hủy bởi người dùng */
const CANCELLABLE_STATUSES = [OrderStatus.PENDING];

/** Các trạng thái cho phép admin xóa đơn hàng */
const DELETABLE_STATUSES = [OrderStatus.CANCELLED, OrderStatus.REFUNDED];

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

      await this.cartService.clearCart(userId);
      return savedOrder;
    });
  }

  async getMyOrders(userId: string): Promise<Order[]> {
    return this.orderRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getOrderDetail(userId: string, orderId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, userId },
      relations: ['items', 'payment'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /** Người dùng tự hủy đơn — chỉ khi status = pending */
  async cancelOrder(userId: string, orderId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Cannot cancel order with status "${order.status}". Only orders in status [${CANCELLABLE_STATUSES.join(', ')}] can be cancelled.`,
      );
    }

    order.status = OrderStatus.CANCELLED;
    return this.orderRepo.save(order);
  }

  // ===========================
  //  Admin methods
  // ===========================

  async getAllOrders(): Promise<Order[]> {
    return this.orderRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['items'],
    });
  }

  async updateOrderStatus(
    orderId: string,
    status: string,
    note?: string,
  ): Promise<Order> {
    const validStatuses = Object.values(OrderStatus);
    if (!validStatuses.includes(status as OrderStatus)) {
      throw new BadRequestException(
        `Invalid status "${status}". Must be one of: ${validStatuses.join(', ')}`,
      );
    }

    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    order.status = status as OrderStatus;
    if (note) order.note = note;

    return this.orderRepo.save(order);
  }

  async deleteOrder(orderId: string): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (!DELETABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Cannot delete order with status "${order.status}". Only orders in status [${DELETABLE_STATUSES.join(', ')}] can be deleted.`,
      );
    }

    await this.orderRepo.remove(order);
  }

  private generateOrderCode(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ORD-${date}-${rand}`;
  }
}