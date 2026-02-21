import { ApiProperty } from '@nestjs/swagger';

import { Category } from '@/modules/category/category.enum';
import { ReportValidationBadgeDto } from '@/modules/report-validation/dto/report-validation-badge.dto';

import { BalanceRecommendationAction } from '../rebalance.interface';

export class BalanceRecommendationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  seq: number;

  @ApiProperty()
  symbol: string;

  @ApiProperty({
    enum: Category,
  })
  category: Category;

  @ApiProperty()
  intensity: number;

  @ApiProperty({ required: false, nullable: true })
  prevIntensity?: number | null;

  @ApiProperty({ required: false, nullable: true })
  prevModelTargetWeight?: number | null;

  @ApiProperty()
  buyScore: number;

  @ApiProperty()
  sellScore: number;

  @ApiProperty()
  modelTargetWeight: number;

  @ApiProperty({
    enum: ['buy', 'sell', 'hold', 'no_trade'],
  })
  action: BalanceRecommendationAction;

  @ApiProperty({ required: false, nullable: true })
  reason?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false, type: () => ReportValidationBadgeDto })
  validation24h?: ReportValidationBadgeDto;

  @ApiProperty({ required: false, type: () => ReportValidationBadgeDto })
  validation72h?: ReportValidationBadgeDto;
}
