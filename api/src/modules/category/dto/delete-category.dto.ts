import { ApiProperty } from '@nestjs/swagger';

import { Category } from '../category.enum';

export class DeleteCategoryDto {
  @ApiProperty({
    enum: Category,
    example: Category.COIN_MAJOR,
  })
  category: Category;
}
