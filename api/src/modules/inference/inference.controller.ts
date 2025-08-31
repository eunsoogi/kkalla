import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CursorItem, PaginatedItem } from '@/modules/item/item.interface';

import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { BalanceRecommendationDto } from './dto/balance-recommendation.dto';
import { GetRecommendationsCursorDto } from './dto/get-recommendations-cursor.dto';
import { GetRecommendationsPaginationDto } from './dto/get-recommendations-pagination.dto';
import { MarketRecommendationDto } from './dto/market-recommendation.dto';
import { InferenceService } from './inference.service';

@Controller('api/v1/inferences')
export class InferenceController {
  constructor(private readonly inferenceService: InferenceService) {}

  @Get('market-recommendations')
  @UseGuards(GoogleTokenAuthGuard)
  public getMarketRecommendations(
    @Query() params: GetRecommendationsPaginationDto,
  ): Promise<PaginatedItem<MarketRecommendationDto>> {
    return this.inferenceService.paginateMarketRecommendations(params);
  }

  @Get('market-recommendations/cursor')
  @UseGuards(GoogleTokenAuthGuard)
  public getMarketRecommendationsCursor(
    @Query() params: GetRecommendationsCursorDto,
  ): Promise<CursorItem<MarketRecommendationDto, string>> {
    return this.inferenceService.cursorMarketRecommendations(params);
  }

  @Get('balance-recommendations')
  @UseGuards(GoogleTokenAuthGuard)
  public getBalanceRecommendations(
    @Query() params: GetRecommendationsPaginationDto,
  ): Promise<PaginatedItem<BalanceRecommendationDto>> {
    return this.inferenceService.paginateBalanceRecommendations(params);
  }

  @Get('balance-recommendations/cursor')
  @UseGuards(GoogleTokenAuthGuard)
  public getBalanceRecommendationsCursor(
    @Query() params: GetRecommendationsCursorDto,
  ): Promise<CursorItem<BalanceRecommendationDto, string>> {
    return this.inferenceService.cursorBalanceRecommendations(params);
  }
}
