import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

import { OrderTypes } from '../upbit.enum';
import { OrderExecutionMode } from '../upbit.types';

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

  @ApiProperty({
    required: false,
    example: 'market',
    enum: ['market', 'limit_ioc', 'limit_post_only'],
  })
  executionMode?: OrderExecutionMode;

  @Type(() => Number)
  @ApiProperty({
    required: false,
    example: 100000000,
  })
  limitPrice?: number;

  @ApiProperty({
    required: false,
    example: 'ioc',
    enum: ['ioc', 'fok', 'po'],
  })
  timeInForce?: 'ioc' | 'fok' | 'po';
}
