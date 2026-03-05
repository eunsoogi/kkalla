import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

import { OrderTypes } from '../upbit.enum';

export class RequestOrderDto {
  @ApiProperty({
    required: true,
    example: 'BTC/KRW',
  })
  symbol: string;

  @ApiProperty({
    required: true,
    example: OrderTypes.BUY,
    enum: OrderTypes,
  })
  type: OrderTypes;

  @Type(() => Number)
  @ApiProperty({
    required: true,
    example: 1000000,
  })
  amount: number;
}
