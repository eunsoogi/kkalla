import { ApiProperty } from '@nestjs/swagger';

import { InferenceCategory } from '@/modules/inference/inference.enum';

export class BlacklistResponseDto {
  @ApiProperty({
    example: '1234-5678-90ab-cdef',
  })
  id!: string;

  @ApiProperty({
    example: 'BTC/KRW',
  })
  ticker!: string;

  @ApiProperty({
    enum: InferenceCategory,
  })
  category!: InferenceCategory;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
