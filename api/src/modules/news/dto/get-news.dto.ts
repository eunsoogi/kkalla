import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

import { GetCursorDto } from '@/modules/item/dto/get-cursor.dto';

import { NewsTypes } from '../news.enum';

export class GetNewsDto extends GetCursorDto<number> {
  @ApiProperty({
    required: true,
    example: NewsTypes.COIN,
    enum: NewsTypes,
  })
  type: NewsTypes = NewsTypes.COIN;

  @Type(() => Number)
  @ApiProperty({
    required: true,
    example: 10,
  })
  limit: number = 10;
}
