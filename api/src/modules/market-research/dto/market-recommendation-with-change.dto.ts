import { ApiProperty } from '@nestjs/swagger';

import { ReportValidationBadgeDto } from '@/modules/report-validation/dto/report-validation-badge.dto';

/**
 * 추천 시점 대비 현재가 변동률이 포함된 마켓 추천 DTO (메인 대시보드용)
 */
export class MarketRecommendationWithChangeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  seq: number;

  @ApiProperty()
  symbol: string;

  @ApiProperty()
  weight: number;

  @ApiProperty()
  reason: string;

  @ApiProperty()
  confidence: number;

  @ApiProperty()
  batchId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  /** 추천 시점 기준 가격 (분봉 해당 분 시가 우선, 없으면 해당일 종가) */
  @ApiProperty({ required: false })
  recommendationPrice?: number;

  /** 현재가 */
  @ApiProperty({ required: false })
  currentPrice?: number;

  /** 추천 시점 대비 변동률 (%) */
  @ApiProperty({ required: false })
  priceChangePct?: number;

  @ApiProperty({ required: false, type: () => ReportValidationBadgeDto })
  validation24h?: ReportValidationBadgeDto;

  @ApiProperty({ required: false, type: () => ReportValidationBadgeDto })
  validation72h?: ReportValidationBadgeDto;
}
