import { ApiProperty } from '@nestjs/swagger';

import { Category } from '@/modules/category/category.enum';

export class BalanceRecommendationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  seq: number;

  @ApiProperty()
  ticker: string;

  @ApiProperty({ enum: Category })
  category: Category;

  @ApiProperty()
  rate: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
