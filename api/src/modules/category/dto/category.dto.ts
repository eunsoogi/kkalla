import { ApiProperty } from '@nestjs/swagger';

import { Category } from '../category.enum';

export class CategoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    enum: Category,
    example: Category.COIN_MAJOR,
  })
  category: Category;

  @ApiProperty({
    example: true,
  })
  enabled: boolean;
}
