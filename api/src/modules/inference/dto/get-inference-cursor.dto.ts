import { ApiProperty } from '@nestjs/swagger';

import { DecisionTypes } from '@/modules/decision/decision.enum';
import { GetCursorDto } from '@/modules/item/dto/get-cursor.dto';
import { ToBoolean } from '@/transforms/boolean.transform';
import { ToDate } from '@/transforms/date.transform';

import { InferenceCategory } from '../inference.enum';

export class GetInferenceCursorDto extends GetCursorDto<string> {
  @ToBoolean()
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

  @ApiProperty({
    required: false,
    type: Date,
  })
  @ToDate()
  startDate?: Date;

  @ApiProperty({
    required: false,
    type: Date,
  })
  @ToDate()
  endDate?: Date;
}
