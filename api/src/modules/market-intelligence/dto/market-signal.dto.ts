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

  @ApiProperty({ required: false, type: () => AllocationAuditBadgeDto })
  validation24h?: AllocationAuditBadgeDto;

  @ApiProperty({ required: false, type: () => AllocationAuditBadgeDto })
  validation72h?: AllocationAuditBadgeDto;
}
