import { ApiProperty } from '@nestjs/swagger';

import { GetPaginationDto } from '@/modules/item/dto/get-pagination.dto';
import { ToDate } from '@/transforms/date.transform';

import { DecisionTypes } from '../decision.enum';

export class GetDecisionDto extends GetPaginationDto {
  @ApiProperty({
    required: true,
    example: false,
  })
  mine: boolean = false;

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
