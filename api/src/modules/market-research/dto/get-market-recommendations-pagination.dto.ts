import { ApiProperty } from '@nestjs/swagger';

import { GetPaginationDto } from '@/modules/item/dto/get-pagination.dto';
import { ToDate } from '@/transforms/date.transform';

export class GetMarketRecommendationsPaginationDto extends GetPaginationDto {
  @ApiProperty({
    required: false,
    example: 'BTC/KRW',
  })
  symbol?: string;

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
