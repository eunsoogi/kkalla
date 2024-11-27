import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

import { SortDirection } from '@/modules/item/item.enum';

export class GetUsersDto {
  @Type(() => Number)
  @ApiProperty({
    required: true,
    example: 1,
  })
  page: number = 1;

  @Type(() => Number)
  @ApiProperty({
    required: true,
    example: 10,
  })
  perPage: number = 10;

  @ApiProperty({
    required: false,
    enum: SortDirection,
    example: SortDirection.DESC,
  })
  sortDirection: SortDirection = SortDirection.DESC;

  @ApiProperty({
    required: false,
    example: '',
  })
  search?: string;
}
