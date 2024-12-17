import { ApiProperty } from '@nestjs/swagger';

import { GetCursorDto } from '@/modules/item/dto/get-cursor.dto';
import { OrderTypes } from '@/modules/upbit/upbit.enum';
import { ToDate } from '@/transforms/date.transform';

export class GetTradeCursorDto extends GetCursorDto<string> {
  @ApiProperty({
    required: false,
    example: 'BTC/KRW',
  })
  ticker?: string;

  @ApiProperty({
    required: false,
    enum: OrderTypes,
  })
  type?: OrderTypes;

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
