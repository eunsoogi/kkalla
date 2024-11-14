import { ApiProperty } from '@nestjs/swagger';

export class GetCursorDto<C> {
  @ApiProperty()
  cursor: C;

  @ApiProperty({
    required: true,
    example: 6,
  })
  limit: number = 6;
}
