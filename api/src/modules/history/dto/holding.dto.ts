import { ApiProperty } from '@nestjs/swagger';

import { Category } from '@/modules/category/category.enum';

/**
 * 보유 종목 한 건 (History 기반, 표시용 currentPrice/dailyChangePct 포함)
 */
export class HoldingDto {
  @ApiProperty()
  symbol: string;

  @ApiProperty({ enum: Category })
  category: Category;

  @ApiProperty({ required: false, description: '현재가 (KRW 마켓만)' })
  currentPrice?: number;

  @ApiProperty({ required: false, description: '당일 변동률 (%)' })
  dailyChangePct?: number;

  @ApiProperty({ required: false, description: '당일 변동액' })
  dailyChangeAbs?: number;
}
