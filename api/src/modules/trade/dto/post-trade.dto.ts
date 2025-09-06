import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

export class PostTradeDto {
  @ApiProperty({
    required: true,
    example: 'BTC/KRW',
  })
  symbol: string;

  @Type(() => Number)
  @ApiProperty({
    required: true,
  })
  diff: number;
}
