import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CursorItem, PaginatedItem } from '@/modules/item/item.interface';

import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { BalanceRecommendationDto } from './dto/balance-recommendation.dto';
import { GetBalanceRecommendationsCursorDto } from './dto/get-balance-recommendations-cursor.dto';
import { GetBalanceRecommendationsPaginationDto } from './dto/get-balance-recommendations-pagination.dto';
import { RebalanceService } from './rebalance.service';

/**
 * 리밸런싱 API 컨트롤러.
 *
 * - 잔고 추천 결과 조회 기능 제공
 */
@Controller('api/v1/rebalance')
export class RebalanceController {
  constructor(private readonly rebalanceService: RebalanceService) {}

  /**
   * 잔고 추천 결과 페이지네이션 조회
   */
  @Get('balance-recommendations')
  @UseGuards(GoogleTokenAuthGuard)
  public getBalanceRecommendations(
    @Query() params: GetBalanceRecommendationsPaginationDto,
  ): Promise<PaginatedItem<BalanceRecommendationDto>> {
    return this.rebalanceService.paginateBalanceRecommendations(params);
  }

  /**
   * 잔고 추천 결과 커서 기반 조회
   */
  @Get('balance-recommendations/cursor')
  @UseGuards(GoogleTokenAuthGuard)
  public getBalanceRecommendationsCursor(
    @Query() params: GetBalanceRecommendationsCursorDto,
  ): Promise<CursorItem<BalanceRecommendationDto, string>> {
    return this.rebalanceService.cursorBalanceRecommendations(params);
  }
}
