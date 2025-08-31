import { ApiProperty } from '@nestjs/swagger';

import { Category } from '@/modules/category/category.enum';
import { GetPaginationDto } from '@/modules/item/dto/get-pagination.dto';
import { ToDate } from '@/transforms/date.transform';

export class GetRecommendationsPaginationDto extends GetPaginationDto {
  @ApiProperty({
    required: false,
    example: 'BTC/KRW',
  })
  ticker?: string;

  @ApiProperty({
    required: true,
    enum: Category,
  })
  category: Category;

  @ApiProperty({
    required: false,
    type: Date,
  })
  @ToDate()
  startDate?: Date;

  @ApiProperty({
    required: false,
    type: Date,
  })
  @ToDate()
  endDate?: Date;
}
