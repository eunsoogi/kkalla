import { ApiProperty } from '@nestjs/swagger';

import { AllocationAuditBadgeDto } from '@/modules/allocation-audit/dto/allocation-audit-badge.dto';
import { Category } from '@/modules/category/category.enum';

import { AllocationRecommendationAction } from '../allocation.interface';

export class AllocationRecommendationDto {
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
  action: AllocationRecommendationAction;

  @ApiProperty({ required: false, nullable: true })
  reason?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false, type: () => AllocationAuditBadgeDto })
  validation24h?: AllocationAuditBadgeDto;

  @ApiProperty({ required: false, type: () => AllocationAuditBadgeDto })
  validation72h?: AllocationAuditBadgeDto;
}
