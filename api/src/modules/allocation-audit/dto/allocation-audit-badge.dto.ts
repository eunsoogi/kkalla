import { ApiProperty } from '@nestjs/swagger';

import { AllocationAuditStatus, AllocationAuditVerdict } from '../allocation-audit.interface';

export class AllocationAuditBadgeDto {
  @ApiProperty({
    enum: ['pending', 'running', 'completed', 'failed'],
  })
  status: AllocationAuditStatus;

  @ApiProperty({ required: false, nullable: true })
  overallScore?: number | null;

  @ApiProperty({
    enum: ['good', 'mixed', 'bad', 'invalid'],
    required: false,
    nullable: true,
  })
  verdict?: AllocationAuditVerdict | null;

  @ApiProperty({ required: false, nullable: true })
  evaluatedAt?: Date | null;
}
