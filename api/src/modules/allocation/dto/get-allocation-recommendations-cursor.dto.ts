import { ApiProperty } from '@nestjs/swagger';

import { Category } from '@/modules/category/category.enum';
import { GetCursorDto } from '@/modules/item/dto/get-cursor.dto';
import { ToDate } from '@/transforms/date.transform';

export class GetAllocationRecommendationsCursorDto extends GetCursorDto<string> {
  @ApiProperty({
    required: false,
    example: 'BTC/KRW',
  })
  symbol?: string;

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
