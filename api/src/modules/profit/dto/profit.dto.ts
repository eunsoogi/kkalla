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
}
