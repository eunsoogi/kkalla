import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

import { OrderExecutionUrgency } from '../upbit.types';

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

  @ApiProperty({
    required: false,
    example: 'urgent',
    enum: ['urgent', 'normal'],
  })
  executionUrgency?: OrderExecutionUrgency;
}
