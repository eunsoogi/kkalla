import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CursorItem, PaginatedItem } from '@/modules/item/item.interface';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { User } from '../user/entities/user.entity';
import { GetTradeCursorDto } from './dto/get-trade-cursor.dto';
import { GetTradeDto } from './dto/get-trade.dto';
import { Trade } from './entities/trade.entity';
import { TradeFilter } from './trade.interface';
import { TradeService } from './trade.service';

/**
 * 거래 조회 전용 컨트롤러.
 *
 * - 거래 실행 기능은 Rebalance 및 Volatility 모듈로 이동됨
 * - 거래 조회 기능만 제공
 */
@Controller('api/v1/trades')
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  /**
   * 거래 목록 페이지네이션 조회 (lastHours 지정 시 최근 N시간 이내 거래만 조회)
   */
  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  public async getTrades(@CurrentUser() user: User, @Query() params: GetTradeDto): Promise<PaginatedItem<Trade>> {
    const request: GetTradeDto & TradeFilter = {
      page: params.page,
      perPage: params.perPage,
      sortDirection: params.sortDirection,
    };
    if (params.lastHours != null && params.lastHours > 0) {
      const now = new Date();
      request.createdAt = {
        gte: new Date(now.getTime() - params.lastHours * 3600000),
        lte: now,
      };
    }
    return this.tradeService.paginateTrades(user, request);
  }

  /**
   * 거래 목록 커서 기반 조회
   */
  @Get('cursor')
  @UseGuards(GoogleTokenAuthGuard)
  public async getCursorTrades(
    @CurrentUser() user: User,
    @Query() params: GetTradeCursorDto,
  ): Promise<CursorItem<Trade, string>> {
    const filters: any = {
      cursor: params.cursor,
      limit: params.limit,
      skip: params.skip,
      symbol: params.symbol,
      type: params.type,
      sortDirection: params.sortDirection,
    };

    if (params.startDate || params.endDate) {
      filters.createdAt = {};

      if (params.startDate) {
        filters.createdAt.gte = params.startDate;
      }

      if (params.endDate) {
        filters.createdAt.lte = params.endDate;
      }
    }

    return this.tradeService.cursorTrades(user, filters);
  }
}
