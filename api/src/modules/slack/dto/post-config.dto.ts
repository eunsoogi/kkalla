import { ApiProperty } from '@nestjs/swagger';

export class PostSlackConfigDto {
  @ApiProperty({
    required: true,
  })
  token: string;

  @ApiProperty({
    required: true,
  })
  channel: string;
}
