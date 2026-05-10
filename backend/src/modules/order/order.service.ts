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
import { Payment, PaymentMethod, PaymentStatus } from '../payment/entities/payment.entity';
import { ProductVariant } from '../catalog/entities/product-variant.entity';
import { CartService } from '../cart/cart.service';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsArray, ValidateNested, IsInt, Min, IsUUID } from 'class-validator';
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

/** Một item được chọn từ giỏ hàng để đặt — có thể đặt số lượng nhỏ hơn cart */
export class OrderItemInputDto {
  @ApiProperty({ example: 'uuid-cart-item-id', description: 'ID của cart item' })
  @IsUUID()
  cartItemId: string;

  @ApiProperty({ example: 1, description: 'Số lượng muốn đặt (1 ≤ qty ≤ số lượng trong cart)', minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

/** Item cho luồng Mua ngay — không cần cartItemId */
export class BuyNowItemDto {
  @ApiProperty({ example: 'uuid-product-id', description: 'ID của sản phẩm' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ example: 'uuid-variant-id', description: 'ID của variant (nếu có)' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ example: 1, description: 'Số lượng muốn mua', minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class BuyNowOrderDto {
  @ApiProperty({ type: ShippingAddressDto })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.COD })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ type: [BuyNowItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BuyNowItemDto)
  items: BuyNowItemDto[];
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

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.COD,
    description: 'Phương thức thanh toán: cod | bank_transfer | momo | vnpay',
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({
    type: [OrderItemInputDto],
    description: 'Danh sách items được chọn từ giỏ hàng kèm số lượng muốn đặt',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];
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
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(ProductVariant) private readonly variantRepo: Repository<ProductVariant>,
    private readonly cartService: CartService,
    private readonly dataSource: DataSource,
  ) {}

  async createFromCart(userId: string, dto: CreateOrderDto): Promise<Order> {
    if (!dto.items?.length) throw new BadRequestException('Vui lòng chọn ít nhất một sản phẩm để đặt hàng');

    // Lấy toàn bộ cart của user để validate và lấy thông tin sản phẩm
    const cart = await this.cartService.getCart(userId);
    const cartMap = new Map(cart.items.map((i) => [i.id, i]));

    // Validate từng item được chọn
    const resolvedItems = dto.items.map((input) => {
      const cartItem = cartMap.get(input.cartItemId);
      if (!cartItem) {
        throw new BadRequestException(`Cart item "${input.cartItemId}" không tồn tại trong giỏ hàng`);
      }
      if (input.quantity > cartItem.quantity) {
        throw new BadRequestException(
          `Số lượng đặt (${input.quantity}) vượt quá số lượng trong giỏ (${cartItem.quantity}) cho sản phẩm "${cartItem.product.name}"`,
        );
      }
      return { cartItem, orderQty: input.quantity };
    });

    // Resolve variantLabel: lookup label từ bảng product_variants thay vì dùng UUID
    const variantIds = resolvedItems
      .map(({ cartItem }) => cartItem.variantId)
      .filter((id): id is string => !!id);

    const variantLabelMap = new Map<string, string>();
    if (variantIds.length) {
      const variants = await this.variantRepo.findByIds(variantIds);
      variants.forEach((v) => variantLabelMap.set(v.id, v.label));
    }

    const SHIPPING_FEE = 30000;
    // Dùng giá variant nếu có, nếu không dùng salePrice/price của product
    const subtotal = resolvedItems.reduce((sum, { cartItem, orderQty }) => {
      const variant = cartItem.variantId ? cartItem.product.variants?.find((v: any) => v.id === cartItem.variantId) : null;
      const price = variant ? Number(variant.price) : Number(cartItem.product.salePrice || cartItem.product.price);
      return sum + price * orderQty;
    }, 0);
    const total = subtotal + SHIPPING_FEE;

    return this.dataSource.transaction(async (em) => {
      // 1. Tạo Order
      const order = em.create(Order, {
        orderCode: this.generateOrderCode(),
        userId,
        shippingAddress: dto.shippingAddress,
        note: dto.note,
        subtotal,
        shippingFee: SHIPPING_FEE,
        discount: 0,
        total,
        status: OrderStatus.PENDING,
      });
      const savedOrder = await em.save(Order, order);

      // 2. Tạo OrderItems — snapshot tại thời điểm đặt, dùng orderQty chứ không phải cart qty
      for (const { cartItem, orderQty } of resolvedItems) {
        const variant = cartItem.variantId ? cartItem.product.variants?.find((v: any) => v.id === cartItem.variantId) : null;
        const price = variant ? Number(variant.price) : Number(cartItem.product.salePrice || cartItem.product.price);
        // variantLabel: lấy tên label (vd: "8GB/128GB") thay vì UUID
        const variantLabel = cartItem.variantId
          ? (variantLabelMap.get(cartItem.variantId) ?? cartItem.variantId)
          : null;
        await em.save(OrderItem, {
          orderId: savedOrder.id,
          productId: cartItem.productId,
          productName: cartItem.product.name,
          productImage: cartItem.product.images?.[0]?.url ?? undefined,
          variantLabel: variantLabel ?? undefined,
          unitPrice: price,
          quantity: orderQty,
          subtotal: price * orderQty,
        });
      }

      // 3. Tạo Payment
      const isCod = dto.paymentMethod === PaymentMethod.COD;
      const payment = em.create(Payment, {
        orderId: savedOrder.id,
        method: dto.paymentMethod,
        amount: total,
        status: isCod ? PaymentStatus.SUCCESS : PaymentStatus.PENDING,
        transactionId: isCod ? `COD-${savedOrder.id}` : null,
        metadata: isCod
          ? { note: 'Thanh toán khi nhận hàng' }
          : { note: 'Chờ xác nhận thanh toán' },
      });
      await em.save(Payment, payment);

      // 4. Cập nhật cart sau khi đặt:
      //    - Đặt toàn bộ qty → xóa item khỏi cart
      //    - Đặt một phần qty → giảm số lượng còn lại trong cart
      for (const { cartItem, orderQty } of resolvedItems) {
        if (orderQty >= cartItem.quantity) {
          await this.cartService.removeItem(userId, cartItem.id);
        } else {
          await this.cartService.updateQuantity(userId, cartItem.id, cartItem.quantity - orderQty);
        }
      }

      // 5. Trả về order kèm đầy đủ relations
      return em.findOneOrFail(Order, {
        where: { id: savedOrder.id },
        relations: ['items', 'payment'],
      });
    });
  }

  /** Mua ngay — tạo order trực tiếp từ productId/variantId, không qua cart */
  async buyNow(userId: string, dto: BuyNowOrderDto): Promise<Order> {
    if (!dto.items?.length) throw new BadRequestException('Vui lòng chọn ít nhất một sản phẩm');

    // Resolve product + variant cho từng item
    const { DataSource: _DS, ..._ } = await import('typeorm');
    const productRepo = this.dataSource.getRepository('products');

    // Lấy product info qua DataSource để tránh circular dependency
    const resolvedItems: Array<{
      productId: string; productName: string; productImage: string | null;
      variantId: string | null; variantLabel: string | null;
      unitPrice: number; quantity: number;
    }> = [];

    for (const item of dto.items) {
      const product = await this.dataSource
        .getRepository('Product')
        .findOne({ where: { id: item.productId }, relations: ['variants'] })
        .catch(() => null);

      if (!product) throw new BadRequestException(`Sản phẩm "${item.productId}" không tồn tại`);

      let unitPrice: number;
      let variantLabel: string | null = null;
      let variantId: string | null = item.variantId ?? null;

      if (item.variantId) {
        const variant = (product as any).variants?.find((v: any) => v.id === item.variantId);
        if (!variant) throw new BadRequestException(`Variant "${item.variantId}" không tồn tại`);
        unitPrice = Number(variant.price);
        variantLabel = variant.label;
      } else {
        unitPrice = Number((product as any).salePrice || (product as any).price);
      }

      resolvedItems.push({
        productId: item.productId,
        productName: (product as any).name,
        productImage: (product as any).images?.[0]?.url ?? null,
        variantId,
        variantLabel,
        unitPrice,
        quantity: item.quantity,
      });
    }

    const SHIPPING_FEE = 30000;
    const subtotal = resolvedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const total = subtotal + SHIPPING_FEE;

    return this.dataSource.transaction(async (em) => {
      const order = em.create(Order, {
        orderCode: this.generateOrderCode(),
        userId,
        shippingAddress: dto.shippingAddress,
        note: dto.note,
        subtotal,
        shippingFee: SHIPPING_FEE,
        discount: 0,
        total,
        status: OrderStatus.PENDING,
      });
      const savedOrder = await em.save(Order, order);

      for (const item of resolvedItems) {
        await em.save(OrderItem, {
          orderId: savedOrder.id,
          productId: item.productId,
          productName: item.productName,
          productImage: item.productImage ?? undefined,
          variantLabel: item.variantLabel ?? undefined,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          subtotal: item.unitPrice * item.quantity,
        });
      }

      const isCod = dto.paymentMethod === PaymentMethod.COD;
      await em.save(Payment, em.create(Payment, {
        orderId: savedOrder.id,
        method: dto.paymentMethod,
        amount: total,
        status: isCod ? PaymentStatus.SUCCESS : PaymentStatus.PENDING,
        transactionId: isCod ? `COD-${savedOrder.id}` : null,
        metadata: isCod ? { note: 'Thanh toán khi nhận hàng' } : { note: 'Chờ xác nhận thanh toán' },
      }));

      return em.findOneOrFail(Order, { where: { id: savedOrder.id }, relations: ['items', 'payment'] });
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