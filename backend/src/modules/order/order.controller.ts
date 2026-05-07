// order.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrderService, CreateOrderDto } from './order.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/roles.decorator';
import { User } from '../user/entities/user.entity';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    return this.orderService.createFromCart(user.id, dto);
  }

  @Get()
  getMyOrders(@CurrentUser() user: User) {
    return this.orderService.getMyOrders(user.id);
  }

  @Get(':id')
  getDetail(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.orderService.getOrderDetail(user.id, id);
  }
}
