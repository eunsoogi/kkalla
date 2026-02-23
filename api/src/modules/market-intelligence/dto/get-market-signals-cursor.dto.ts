import { ApiProperty } from '@nestjs/swagger';

import { GetCursorDto } from '@/modules/item/dto/get-cursor.dto';
import { ToDate } from '@/transforms/date.transform';

export class GetMarketSignalsCursorDto extends GetCursorDto<string> {
  @ApiProperty({
    required: false,
    example: 'BTC/KRW',
  })
  symbol?: string;

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
