import { ApiProperty } from '@nestjs/swagger';

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

  /** 추천 시점 기준 가격 (해당일 종가) */
  @ApiProperty({ required: false })
  recommendationPrice?: number;

  /** 현재가 */
  @ApiProperty({ required: false })
  currentPrice?: number;

  /** 추천 시점 대비 변동률 (%) */
  @ApiProperty({ required: false })
  priceChangePct?: number;
}
