import { ApiProperty } from '@nestjs/swagger';

import { Category } from '@/modules/category/category.enum';

export class BlacklistDto {
  @ApiProperty({
    example: '1234-5678-90ab-cdef',
  })
  id!: string;

  @ApiProperty({
    example: 'BTC/KRW',
  })
  symbol!: string;

  @ApiProperty({
    enum: Category,
  })
  category!: Category;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
