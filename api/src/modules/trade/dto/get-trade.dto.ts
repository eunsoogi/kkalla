import { ApiProperty } from '@nestjs/swagger';

export class GetTradeDto {
  @ApiProperty({
    required: true,
    example: 1,
  })
  page: number = 1;

  @ApiProperty({
    required: true,
    example: 6,
  })
  perPage: number = 6;
}
