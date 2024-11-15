import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

export class GetNotifyDto {
  @Type(() => Number)
  @ApiProperty({
    required: true,
    example: 1,
  })
  page: number = 1;

  @Type(() => Number)
  @ApiProperty({
    required: true,
    example: 5,
  })
  perPage: number = 5;
}
