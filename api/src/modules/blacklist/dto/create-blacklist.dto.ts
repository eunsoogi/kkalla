import { ApiProperty } from '@nestjs/swagger';

import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

import { InferenceCategory } from '@/modules/inference/inference.enum';

export class CreateBlacklistDto {
  @ApiProperty({
    required: true,
    example: 'BTC/KRW',
  })
  @IsString()
  @IsNotEmpty()
  ticker!: string;

  @ApiProperty({
    required: true,
    enum: InferenceCategory,
  })
  @IsEnum(InferenceCategory)
  @IsNotEmpty()
  category!: InferenceCategory;
}
