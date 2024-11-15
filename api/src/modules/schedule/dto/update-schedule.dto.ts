import { ApiProperty } from '@nestjs/swagger';

import { ToBoolean } from '@/transforms/boolean.transform';

export class CreateScheduleDto {
  @ToBoolean()
  @ApiProperty({
    required: true,
    example: false,
  })
  enabled: boolean = false;
}
