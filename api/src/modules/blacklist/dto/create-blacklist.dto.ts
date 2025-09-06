import { ApiProperty } from '@nestjs/swagger';

import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

import { Category } from '@/modules/category/category.enum';

export class CreateBlacklistDto {
  @ApiProperty({
    required: true,
    example: 'BTC/KRW',
  })
  @IsString()
  @IsNotEmpty()
  symbol!: string;

  @ApiProperty({
    required: true,
    enum: Category,
  })
  @IsEnum(Category)
  @IsNotEmpty()
  category!: Category;
}
