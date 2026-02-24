import { ApiProperty } from '@nestjs/swagger';

import { AllocationAuditBadgeDto } from '@/modules/allocation-audit/dto/allocation-audit-badge.dto';

export class MarketSignalDto {
  @ApiProperty()
  id: string;

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

  @ApiProperty({ required: false, type: () => AllocationAuditBadgeDto })
  validation24h?: AllocationAuditBadgeDto;

  @ApiProperty({ required: false, type: () => AllocationAuditBadgeDto })
  validation72h?: AllocationAuditBadgeDto;
}
