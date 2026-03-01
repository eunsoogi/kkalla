import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { Balances, Order } from 'ccxt';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { User } from '../user/entities/user.entity';
import { CreateUpbitConfigDto } from './dto/create-config.dto';
import { RequestAdjustOrderDto } from './dto/request-adjust-order.dto';
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

  @Post('order/adjust')
  @UseGuards(GoogleTokenAuthGuard)
  public async postAdjustOrder(
    @CurrentUser() user: User,
    @Body() request: RequestAdjustOrderDto,
  ): Promise<Order | null> {
    const adjusted = await this.upbitService.adjustOrder(user, {
      ...request,
      balances: await this.upbitService.getBalances(user),
    });

    return adjusted.order;
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

  @Get('balances')
  @UseGuards(GoogleTokenAuthGuard)
  public async getBalances(@CurrentUser() user: User): Promise<Balances> {
    return this.upbitService.getBalances(user);
  }
}
