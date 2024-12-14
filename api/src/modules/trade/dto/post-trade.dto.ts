import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

export class PostTradeDto {
  @ApiProperty({
    required: true,
    example: 'BTC/KRW',
  })
  ticker: string;

  @Type(() => Number)
  @ApiProperty({
    required: true,
  })
  diff: number;
}
