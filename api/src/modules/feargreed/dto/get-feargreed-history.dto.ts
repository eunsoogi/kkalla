import { ApiProperty } from '@nestjs/swagger';

export class FeargreedHistoryDto {
  @ApiProperty({
    required: false,
    type: Number,
    default: 30,
  })
  limit?: number = 30;
}
