import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CursorItem, PaginatedItem } from '@/modules/item/item.interface';

import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { GetMarketRecommendationsCursorDto } from './dto/get-market-recommendations-cursor.dto';
import { GetMarketRecommendationsPaginationDto } from './dto/get-market-recommendations-pagination.dto';
import { MarketRecommendationWithChangeDto } from './dto/market-recommendation-with-change.dto';
import { MarketRecommendationDto } from './dto/market-recommendation.dto';
import { MarketResearchService } from './market-research.service';

/**
 * 시장 조사 API 컨트롤러.
 *
 * - 시장 추천 결과 조회 기능 제공
 */
@Controller('api/v1/market-research')
export class MarketResearchController {
  constructor(private readonly marketResearchService: MarketResearchService) {}

  /**
   * 시장 추천 결과 페이지네이션 조회
   */
  @Get('market-recommendations')
  @UseGuards(GoogleTokenAuthGuard)
  public getMarketRecommendations(
    @Query() params: GetMarketRecommendationsPaginationDto,
  ): Promise<PaginatedItem<MarketRecommendationDto>> {
    return this.marketResearchService.paginateMarketRecommendations(params);
  }

  /**
   * 시장 추천 결과 커서 기반 조회
   */
  @Get('market-recommendations/cursor')
  @UseGuards(GoogleTokenAuthGuard)
  public getMarketRecommendationsCursor(
    @Query() params: GetMarketRecommendationsCursorDto,
  ): Promise<CursorItem<MarketRecommendationDto, string>> {
    return this.marketResearchService.cursorMarketRecommendations(params);
  }

  /**
   * 최신 마켓 리포트 (추천 시점 대비 현재가 변동률 포함, 메인 대시보드용)
   */
  @Get('latest')
  @UseGuards(GoogleTokenAuthGuard)
  public getLatestWithPriceChange(@Query('limit') limit?: string): Promise<MarketRecommendationWithChangeDto[]> {
    const parsed = limit != null ? parseInt(limit, 10) : NaN;
    const limitNum = Number.isNaN(parsed) || parsed < 1 ? 10 : Math.min(parsed, 50);
    return this.marketResearchService.getLatestWithPriceChange(limitNum);
  }
}
