import { ApiProperty } from '@nestjs/swagger';

import { AllocationAuditBadgeDto } from '@/modules/allocation-audit/dto/allocation-audit-badge.dto';
import { Category } from '@/modules/category/category.enum';

export class AllocationRecommendationDto {
  @ApiProperty()
  id: string;

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

  @ApiProperty({ required: false, nullable: true })
  reason?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false, nullable: true })
  btcDominance?: number | null;

  @ApiProperty({ required: false, nullable: true })
  altcoinIndex?: number | null;

  @ApiProperty({ required: false, nullable: true })
  marketRegimeAsOf?: Date | null;

  @ApiProperty({ required: false, nullable: true, enum: ['live', 'cache_fallback'] })
  marketRegimeSource?: 'live' | 'cache_fallback' | null;

  @ApiProperty({ required: false, nullable: true })
  marketRegimeIsStale?: boolean | null;

  @ApiProperty({ required: false, nullable: true })
  feargreedIndex?: number | null;

  @ApiProperty({ required: false, nullable: true })
  feargreedClassification?: string | null;

  @ApiProperty({ required: false, nullable: true })
  feargreedTimestamp?: Date | null;

  @ApiProperty({ required: false, nullable: true, description: '0~1 비율 값' })
  decisionConfidence?: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: '0~1 비율 값 (예: 0.024 = 2.4%)',
  })
  expectedVolatilityPct?: number | null;

  @ApiProperty({ required: false, nullable: true, type: [String] })
  riskFlags?: string[] | null;

  @ApiProperty({ required: false, nullable: true, description: '0~1 비율 값' })
  expectedEdgeRate?: number | null;

  @ApiProperty({ required: false, nullable: true, description: '0~1 비율 값' })
  estimatedCostRate?: number | null;

  @ApiProperty({ required: false, nullable: true, description: '0~1 비율 값' })
  spreadRate?: number | null;

  @ApiProperty({ required: false, nullable: true, description: '0~1 비율 값' })
  impactRate?: number | null;

  @ApiProperty({ required: false, type: () => AllocationAuditBadgeDto })
  validation24h?: AllocationAuditBadgeDto;

  @ApiProperty({ required: false, type: () => AllocationAuditBadgeDto })
  validation72h?: AllocationAuditBadgeDto;
}
