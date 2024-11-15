import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

export class GetTradeDto {
  @Type(() => Number)
  @ApiProperty({
    required: true,
    example: 1,
  })
  page: number = 1;

  @Type(() => Number)
  @ApiProperty({
    required: true,
    example: 6,
  })
  perPage: number = 6;
}
