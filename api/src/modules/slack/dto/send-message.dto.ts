import { ApiProperty } from '@nestjs/swagger';

export class SendSlackMessageDto {
  @ApiProperty({
    required: true,
  })
  message: string;
}
