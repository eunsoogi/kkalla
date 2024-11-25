import { ApiProperty } from '@nestjs/swagger';

import { User } from '@/modules/user/entities/user.entity';

import { DecisionTypes } from '../decision.enum';

export class DecisionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  seq: number;

  @ApiProperty({ type: () => [User] })
  users: User[];

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
