import { ApiProperty } from '@nestjs/swagger';

import { Category } from '@/modules/category/category.enum';
import { GetCursorDto } from '@/modules/item/dto/get-cursor.dto';
import { ToDate } from '@/transforms/date.transform';

export class GetRecommendationsCursorDto extends GetCursorDto<string> {
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
