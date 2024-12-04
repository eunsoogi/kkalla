import { ApiProperty } from '@nestjs/swagger';

export class AccumulationDto {
  @ApiProperty({
    example: 'BTC',
  })
  market: string;

  @ApiProperty({
    example: 'KRW',
  })
  symbol: string;

  @ApiProperty({
    example: 847.78733544,
  })
  avg: number;

  @ApiProperty({
    example: 868,
  })
  price: number;

  @ApiProperty({
    example: 0.02384166844095,
  })
  priceRate: number;

  @ApiProperty({
    example: 111.39,
  })
  strength: number;

  @ApiProperty({
    example: new Date(),
  })
  createdAt: Date;

  @ApiProperty({
    example: new Date(),
  })
  updatedAt: Date;
}
