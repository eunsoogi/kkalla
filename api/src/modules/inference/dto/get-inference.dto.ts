import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

import { ToBoolean } from '@/transforms/boolean.transform';

export class GetInferenceDto {
  @ToBoolean()
  @ApiProperty({
    required: true,
    example: false,
  })
  mine: boolean = false;

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
