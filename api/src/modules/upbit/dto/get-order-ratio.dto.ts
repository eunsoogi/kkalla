import { ApiProperty } from '@nestjs/swagger';

export class GetOrderRatioDto {
  @ApiProperty({
    required: true,
    default: 'BTC',
  })
  symbol: string;
}
