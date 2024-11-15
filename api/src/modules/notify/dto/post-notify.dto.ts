import { ApiProperty } from '@nestjs/swagger';

export class PostNotifyDto {
  @ApiProperty({
    required: true,
  })
  message: string;
}
