import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

export class RequestAdjustOrderDto {
  @ApiProperty({
    required: true,
    example: 'BTC/KRW',
  })
  symbol: string;

  @Type(() => Number)
  @ApiProperty({
    required: true,
    example: -0.5,
  })
  diff: number;
}
