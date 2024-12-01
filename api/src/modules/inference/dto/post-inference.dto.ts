import { ApiProperty } from '@nestjs/swagger';

export class PostInferenceDto {
  @ApiProperty({
    example: 'BTC',
  })
  symbol: string;

  @ApiProperty({
    example: 'KRW',
  })
  market: string;
}
