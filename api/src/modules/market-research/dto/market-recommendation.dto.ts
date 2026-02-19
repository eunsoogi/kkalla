import { ApiProperty } from '@nestjs/swagger';

import { ReportValidationBadgeDto } from '@/modules/report-validation/dto/report-validation-badge.dto';

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

  @ApiProperty({ required: false, type: () => ReportValidationBadgeDto })
  validation24h?: ReportValidationBadgeDto;

  @ApiProperty({ required: false, type: () => ReportValidationBadgeDto })
  validation72h?: ReportValidationBadgeDto;
}
