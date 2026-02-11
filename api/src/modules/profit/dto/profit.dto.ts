import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

export class ProfitDto {
  @ApiProperty({
    required: true,
    example: 'example@example.com',
  })
  email: string;

  @Type(() => Number)
  @ApiProperty({
    required: true,
    example: 0,
  })
  profit: number = 0;

  @Type(() => Number)
  @ApiProperty({
    required: false,
    example: 0,
    description: '오늘 기준 수익',
  })
  todayProfit?: number = 0;
}
