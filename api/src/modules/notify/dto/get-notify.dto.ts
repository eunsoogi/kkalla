import { ApiProperty } from '@nestjs/swagger';

export class GetNotifyDto {
  @ApiProperty({
    required: true,
    example: 1,
  })
  page: number = 1;

  @ApiProperty({
    required: true,
    example: 5,
  })
  perPage: number = 5;
}
