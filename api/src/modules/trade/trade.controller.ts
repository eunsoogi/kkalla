import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { PaginatedItem } from '@/modules/item/item.interface';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { User } from '../user/entities/user.entity';
import { GetTradeDto } from './dto/get-trade.dto';
import { Trade } from './entities/trade.entity';
import { TradeService } from './trade.service';

@Controller('api/v1/trades')
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public async get(@CurrentUser() user: User, @Query() request: GetTradeDto): Promise<PaginatedItem<Trade>> {
    return this.tradeService.paginate(user, request);
  }

  @Post()
  @UseGuards(GoogleTokenAuthGuard)
  public async post(@CurrentUser() user: User): Promise<Trade[]> {
    return await this.tradeService.adjustPortfolios([user]);
  }
}
