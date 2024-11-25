import { ApiProperty } from '@nestjs/swagger';

import { DecisionTypes } from '@/modules/decision/decision.enum';
import { GetCursorDto } from '@/modules/item/dto/get-cursor.dto';
import { SortDirection } from '@/modules/item/item.enum';
import { ToBoolean } from '@/transforms/boolean.transform';
import { ToDate } from '@/transforms/date.transform';

export class GetDecisionCursorDto extends GetCursorDto<string> {
  @ToBoolean()
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
