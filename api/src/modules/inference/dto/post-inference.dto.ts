import { ApiProperty } from '@nestjs/swagger';

import { InferenceCategory } from '../inference.enum';

export class PostInferenceDto {
  @ApiProperty({
    required: true,
    example: 'BTC/KRW',
  })
  ticker: string;

  @ApiProperty({
    required: true,
    example: InferenceCategory.COIN_MAJOR,
    enum: InferenceCategory,
  })
  category: InferenceCategory;
}
