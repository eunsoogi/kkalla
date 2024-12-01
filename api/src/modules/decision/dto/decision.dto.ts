import { ApiProperty } from '@nestjs/swagger';

import { DecisionTypes } from '../decision.enum';

export class DecisionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  seq: number;

  @ApiProperty()
  ticker: string;

  @ApiProperty({ enum: DecisionTypes })
  decision: DecisionTypes;

  @ApiProperty()
  orderRatio: number;

  @ApiProperty()
  weightLowerBound: number;

  @ApiProperty()
  weightUpperBound: number;

  @ApiProperty()
  reason: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
