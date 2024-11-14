import { ApiProperty } from '@nestjs/swagger';

import { ToBoolean } from '@/transforms/boolean.transform';

export class GetInferenceDto {
  @ToBoolean()
  @ApiProperty({
    required: true,
    example: false,
  })
  mine: boolean = false;

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
