import { ApiProperty } from '@nestjs/swagger';

import { OrderTypes } from '../upbit.enum';

export class RequestOrderDto {
  @ApiProperty({
    required: true,
    example: 'BTC',
  })
  symbol: string;

  @ApiProperty({
    required: true,
    example: 'KRW',
  })
  market: string;

  @ApiProperty({
    required: true,
    example: OrderTypes.BUY,
  })
  type: OrderTypes;

  @ApiProperty({
    required: true,
    example: 0.3,
  })
  rate: number;
}
