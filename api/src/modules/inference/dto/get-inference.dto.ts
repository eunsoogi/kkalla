import { ApiProperty } from '@nestjs/swagger';

import { GetPaginationDto } from '@/modules/item/dto/get-pagination.dto';
import { ToDate } from '@/transforms/date.transform';

import { DecisionTypes } from '../../decision/decision.enum';
import { InferenceCategory } from '../inference.enum';

export class GetInferenceDto extends GetPaginationDto {
  @ApiProperty({
    required: true,
    example: false,
  })
  mine: boolean = false;

  @ApiProperty({
    required: true,
    enum: InferenceCategory,
  })
  category: InferenceCategory;

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
