import { ApiProperty } from '@nestjs/swagger';

import { GetCursorDto } from '@/modules/item/dto/get-cursor.dto';
import { SortDirection } from '@/modules/item/item.enum';
import { ToBoolean } from '@/transforms/boolean.transform';
import { ToDate } from '@/transforms/date.transform';

import { InferenceDecisionTypes } from '../inference.enum';

export class GetInferenceCursorDto extends GetCursorDto<string> {
  @ToBoolean()
  @ApiProperty({
    required: true,
    example: false,
  })
  mine: boolean = false;

  @ApiProperty({
    required: false,
    enum: InferenceDecisionTypes,
  })
  decision?: InferenceDecisionTypes;

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

  @ApiProperty({
    required: false,
    enum: SortDirection,
    default: SortDirection.DESC,
  })
  sortDirection?: SortDirection = SortDirection.DESC;
}
