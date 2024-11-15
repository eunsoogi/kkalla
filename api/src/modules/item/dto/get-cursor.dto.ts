import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

import { ToBoolean } from '@/transforms/boolean.transform';

export class GetCursorDto<C> {
  @ApiProperty()
  cursor: C;

  @Type(() => Number)
  @ApiProperty({
    required: true,
    example: 6,
  })
  limit: number = 6;

  @ToBoolean()
  @ApiProperty({
    required: true,
    example: true,
  })
  skip: boolean = true;
}
