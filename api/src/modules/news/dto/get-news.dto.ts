import { ApiProperty } from '@nestjs/swagger';

import { GetCursorDto } from '@/modules/item/dto/get-cursor.dto';

import { NewsTypes } from '../news.enum';

export class GetNewsDto extends GetCursorDto<number> {
  @ApiProperty({
    required: true,
    example: NewsTypes.COIN,
  })
  type: NewsTypes = NewsTypes.COIN;

  @ApiProperty({
    required: true,
    example: 10,
  })
  limit: number = 10;
}
