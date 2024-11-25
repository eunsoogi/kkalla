import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

import { SortDirection } from '@/modules/item/item.enum';
import { ToDate } from '@/transforms/date.transform';

import { DecisionTypes } from '../decision.enum';

export class GetDecisionDto {
  @ApiProperty({
    required: true,
    example: false,
  })
  mine: boolean = false;

  @Type(() => Number)
  @ApiProperty({
    required: true,
    example: 1,
  })
  page: number = 1;

  @Type(() => Number)
  @ApiProperty({
    required: true,
    example: 6,
  })
  perPage: number = 6;

  @ApiProperty({
    required: false,
    enum: SortDirection,
    default: SortDirection.DESC,
  })
  sortDirection?: SortDirection = SortDirection.DESC;

  @ApiProperty({
    required: false,
    enum: DecisionTypes,
  })
  decision?: DecisionTypes;

  @ToDate()
  @ApiProperty({
    required: false,
    type: Date,
  })
  startDate?: Date;

  @ToDate()
  @ApiProperty({
    required: false,
    type: Date,
  })
  endDate?: Date;
}
