import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CursorItem, PaginatedItem } from '@/modules/item/item.types';

import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { GetMarketSignalsCursorDto } from './dto/get-market-signals-cursor.dto';
import { GetMarketSignalsPaginationDto } from './dto/get-market-signals-pagination.dto';
import { MarketSignalWithChangeDto } from './dto/market-signal-with-change.dto';
import { MarketSignalDto } from './dto/market-signal.dto';
import { MarketIntelligenceService } from './market-intelligence.service';

/**
 * 시장 조사 API 컨트롤러.
 *
 * - 시장 시그널 결과 조회 기능 제공
 */
@Controller('api/v1/market-intelligence')
export class MarketIntelligenceController {
  constructor(private readonly marketIntelligenceService: MarketIntelligenceService) {}

  /**
   * 시장 시그널 결과 페이지네이션 조회
   */
  @Get('market-signals')
  @UseGuards(GoogleTokenAuthGuard)
  public getMarketSignals(@Query() params: GetMarketSignalsPaginationDto): Promise<PaginatedItem<MarketSignalDto>> {
    return this.marketIntelligenceService.paginateMarketSignals(params);
  }

  /**
   * 시장 시그널 결과 커서 기반 조회
   */
  @Get('market-signals/cursor')
  @UseGuards(GoogleTokenAuthGuard)
  public getMarketSignalsCursor(
    @Query() params: GetMarketSignalsCursorDto,
  ): Promise<CursorItem<MarketSignalDto, string>> {
    return this.marketIntelligenceService.cursorMarketSignals(params);
  }

  /**
   * 최신 마켓 리포트 (추천 시점 대비 현재가 변동률 포함, 메인 대시보드용)
   */
  @Get('latest')
  @UseGuards(GoogleTokenAuthGuard)
  public getLatestWithPriceChange(@Query('limit') limit?: string): Promise<MarketSignalWithChangeDto[]> {
    const parsed = limit != null ? parseInt(limit, 10) : NaN;
    const limitNum = Number.isNaN(parsed) || parsed < 1 ? 10 : Math.min(parsed, 50);
    return this.marketIntelligenceService.getLatestWithPriceChange(limitNum);
  }
}
