import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CursorItem, PaginatedItem } from '@/modules/item/item.types';

import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { AllocationService } from './allocation.service';
import { AllocationRecommendationDto } from './dto/allocation-recommendation.dto';
import { GetAllocationRecommendationsCursorDto } from './dto/get-allocation-recommendations-cursor.dto';
import { GetAllocationRecommendationsPaginationDto } from './dto/get-allocation-recommendations-pagination.dto';

/**
 * 리밸런싱 API 컨트롤러.
 *
 * - 잔고 추천 결과 조회 기능 제공
 */
@Controller('api/v1/allocation')
export class AllocationController {
  constructor(private readonly allocationService: AllocationService) {}

  /**
   * 잔고 추천 결과 페이지네이션 조회
   */
  @Get('allocation-recommendations')
  @UseGuards(GoogleTokenAuthGuard)
  public getAllocationRecommendations(
    @Query() params: GetAllocationRecommendationsPaginationDto,
  ): Promise<PaginatedItem<AllocationRecommendationDto>> {
    return this.allocationService.paginateAllocationRecommendations(params);
  }

  /**
   * 잔고 추천 결과 커서 기반 조회
   */
  @Get('allocation-recommendations/cursor')
  @UseGuards(GoogleTokenAuthGuard)
  public getAllocationRecommendationsCursor(
    @Query() params: GetAllocationRecommendationsCursorDto,
  ): Promise<CursorItem<AllocationRecommendationDto, string>> {
    return this.allocationService.cursorAllocationRecommendations(params);
  }
}
