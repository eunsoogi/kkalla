import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

import { ToBoolean } from '@/transforms/boolean.transform';

import { SortDirection } from '../item.enum';

export class GetCursorDto<C> {
  @ApiProperty({
    required: false,
  })
  cursor?: C;

  @Type(() => Number)
  @ApiProperty({
    required: true,
    example: 10,
  })
  limit: number = 10;

  @ToBoolean()
  @ApiProperty({
    required: true,
    example: true,
  })
  skip: boolean = true;

  @ApiProperty({
    required: false,
    enum: SortDirection,
    default: SortDirection.DESC,
  })
  sortDirection?: SortDirection = SortDirection.DESC;
}
