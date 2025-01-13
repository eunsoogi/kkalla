import { ApiProperty } from '@nestjs/swagger';

import { Category } from '@/modules/category/category.enum';

export class PostInferenceDto {
  @ApiProperty({
    required: true,
    example: 'BTC/KRW',
  })
  ticker: string;

  @ApiProperty({
    required: true,
    example: Category.COIN_MAJOR,
    enum: Category,
  })
  category: Category;
}
