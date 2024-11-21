import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { Order } from 'ccxt';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { GoogleTokenAuthGuard } from '../auth/google.guard';
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
  public async postOrder(@Req() req, @Body() request: RequestOrderDto): Promise<Order> {
    return this.upbitService.order(req.user, request);
  }

  @Post('order-ratio')
  @UseGuards(GoogleTokenAuthGuard)
  public async getOrderRatio(@Req() req, @Body() request: GetOrderRatioDto): Promise<number> {
    return this.upbitService.getOrderRatio(req.user, request.symbol);
  }

  @Post('config')
  @UseGuards(GoogleTokenAuthGuard)
  public async postConfig(@Req() req, @Body() request: CreateUpbitConfigDto): Promise<UpbitConfig> {
    return this.upbitService.createConfig(req.user, request);
  }

  @Get('status')
  @UseGuards(GoogleTokenAuthGuard)
  public async status(@Req() req): Promise<ApikeyStatus> {
    return this.upbitService.status(req.user);
  }
}
