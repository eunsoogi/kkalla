import { ApiProperty } from '@nestjs/swagger';

import { Category } from '@/modules/category/category.enum';

export class BalanceRecommendationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  seq: number;

  @ApiProperty()
  symbol: string;

  @ApiProperty({
    enum: Category,
  })
  category: Category;

  @ApiProperty()
  rate: number;

  @ApiProperty({ required: false, nullable: true })
  prevRate?: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
