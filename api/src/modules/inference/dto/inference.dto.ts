import { ApiProperty } from '@nestjs/swagger';

export class InferenceDto {
  @ApiProperty({
    example: 0.7,
  })
  rate: number;

  @ApiProperty({
    example: 'BTC/KRW',
  })
  ticker: string;

  @ApiProperty()
  reason: string;
}
