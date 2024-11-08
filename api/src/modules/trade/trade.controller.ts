import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';

import { PaginatedItem } from '@/modules/item/item.interface';

import { GoogleTokenAuthGuard } from '../auth/google.guard';
import { GetTradeDto } from './dto/get-trade.dto';
import { PostTradeDto } from './dto/post-trade.dto';
import { Trade } from './entities/trade.entity';
import { TradeService } from './trade.service';

@Controller('api/v1/trades')
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public get(@Req() req, @Query() request: GetTradeDto): Promise<PaginatedItem<Trade>> {
    return this.tradeService.paginate(req.user, request);
  }

  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  public post(@Req() req, @Body() body: PostTradeDto): Promise<Trade> {
    return this.tradeService.trade(req.user, body);
  }
}
