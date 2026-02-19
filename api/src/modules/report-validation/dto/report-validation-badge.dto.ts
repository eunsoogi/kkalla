import { ApiProperty } from '@nestjs/swagger';

import { ReportValidationStatus, ReportValidationVerdict } from '../report-validation.interface';

export class ReportValidationBadgeDto {
  @ApiProperty({
    enum: ['pending', 'running', 'completed', 'failed'],
  })
  status: ReportValidationStatus;

  @ApiProperty({ required: false, nullable: true })
  overallScore?: number | null;

  @ApiProperty({
    enum: ['good', 'mixed', 'bad', 'invalid'],
    required: false,
    nullable: true,
  })
  verdict?: ReportValidationVerdict | null;

  @ApiProperty({ required: false, nullable: true })
  evaluatedAt?: Date | null;
}
