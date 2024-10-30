import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';

import { FindItemDto } from 'src/dto/find-item.dto';
import { PaginatedItemDto } from 'src/dto/paginated-item.dto';

import { GoogleTokenAuthGuard } from '../auth/google.guard';
import { Trade } from './entities/trade.entity';
import { TradeService } from './trade.service';

@Controller('api/v1/trades')
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public get(@Req() req, @Query() findItemDto: FindItemDto): Promise<PaginatedItemDto<Trade>> {
    return this.tradeService.paginate(req.user, findItemDto);
  }
}
