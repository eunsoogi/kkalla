import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

import { SortDirection } from '../item.enum';

export class GetPaginationDto {
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
  perPage: number = 10;

  @ApiProperty({
    required: false,
    enum: SortDirection,
    default: SortDirection.DESC,
  })
  sortDirection?: SortDirection = SortDirection.DESC;
}
