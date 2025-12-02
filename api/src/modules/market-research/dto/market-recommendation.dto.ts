import { ApiProperty } from '@nestjs/swagger';

export class MarketRecommendationDto {
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
}
