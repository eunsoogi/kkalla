import { ApiProperty } from '@nestjs/swagger';

export class PostInferenceDto {
  @ApiProperty({
    required: true,
    example: 'BTC',
  })
  symbol: string = 'BTC';

  @ApiProperty({
    required: true,
    example: 'KRW',
  })
  market: string = 'KRW';
}
