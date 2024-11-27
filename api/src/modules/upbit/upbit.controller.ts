import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { Order } from 'ccxt';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { User } from '../user/entities/user.entity';
import { CreateUpbitConfigDto } from './dto/create-config.dto';
import { GetOrderRatioDto } from './dto/get-order-ratio.dto';
import { RequestOrderDto } from './dto/request-order.dto';
import { UpbitConfig } from './entities/upbit-config.entity';
import { UpbitService } from './upbit.service';

@Controller('api/v1/upbit')
export class UpbitController {
  constructor(private readonly upbitService: UpbitService) {}

  @Post('order')
  @UseGuards(GoogleTokenAuthGuard)
  public async postOrder(@CurrentUser() user: User, @Body() request: RequestOrderDto): Promise<Order> {
    return this.upbitService.order(user, request);
  }

  @Post('order-ratio')
  @UseGuards(GoogleTokenAuthGuard)
  public async getOrderRatio(@CurrentUser() user: User, @Body() request: GetOrderRatioDto): Promise<number> {
    return this.upbitService.getOrderRatio(user, request.symbol);
  }

  @Post('config')
  @UseGuards(GoogleTokenAuthGuard)
  public async postConfig(@CurrentUser() user: User, @Body() request: CreateUpbitConfigDto): Promise<UpbitConfig> {
    return this.upbitService.createConfig(user, request);
  }

  @Get('status')
  @UseGuards(GoogleTokenAuthGuard)
  public async status(@CurrentUser() user: User): Promise<ApikeyStatus> {
    return this.upbitService.status(user);
  }
}
