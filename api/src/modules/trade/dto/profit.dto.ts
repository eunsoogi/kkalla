import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

export class ProfitDto {
  @Type(() => Number)
  @ApiProperty({
    required: true,
    example: 0,
  })
  profit: number = 0;
}
