import { ApiProperty } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({
    required: true,
    example: false,
  })
  enabled: boolean = false;
}
