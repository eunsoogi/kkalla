import { ApiProperty } from '@nestjs/swagger';

import { GetCursorDto } from '@/modules/item/dto/get-cursor.dto';
import { ToDate } from '@/transforms/date.transform';

import { InferenceCategory } from '../inference.enum';

export class GetInferenceCursorDto extends GetCursorDto<string> {
  @ApiProperty({
    required: false,
    example: 'BTC/KRW',
  })
  ticker?: string;

  @ApiProperty({
    required: true,
    enum: InferenceCategory,
  })
  category: InferenceCategory;

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
