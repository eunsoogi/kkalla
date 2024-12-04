import { ApiProperty } from '@nestjs/swagger';

import { SortDirection } from '@/modules/item/item.enum';

export class GetAccumulationDto {
  @ApiProperty({
    required: false,
  })
  symbol?: string;

  @ApiProperty({
    example: 'KRW',
    required: false,
  })
  market?: string;

  @ApiProperty({
    default: true,
  })
  open: boolean = true;

  @ApiProperty({
    default: true,
  })
  distinct: boolean = true;

  @ApiProperty({
    default: 1,
    required: false,
  })
  start?: number;

  @ApiProperty({
    default: 20,
    required: false,
  })
  display?: number;

  @ApiProperty({
    default: 'updated_at',
  })
  order: string = 'updated_at';

  @ApiProperty({
    enum: SortDirection,
    default: SortDirection.DESC,
  })
  sortDirection: SortDirection = SortDirection.DESC;

  @ApiProperty({
    required: false,
  })
  priceRateLower?: number;

  @ApiProperty({
    required: false,
  })
  priceRateUpper?: number;
}
