import { Controller, Get, Post, Query } from '@nestjs/common';

import { FindItemDto } from 'src/dto/find-item.dto';
import { PaginatedItemDto } from 'src/dto/paginated-item.dto';

import { Trade } from './entities/trade.entity';
import { TradeService } from './trade.service';

@Controller('api/v1/trades')
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  @Get()
  public get(@Query() findItemDto: FindItemDto): Promise<PaginatedItemDto<Trade>> {
    return this.tradeService.paginate(findItemDto);
  }

  @Post()
  public async request() {
    return await this.tradeService.trade();
  }
}
