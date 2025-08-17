import { ApiProperty } from '@nestjs/swagger';

export class SendServerMessageDto {
  @ApiProperty({
    required: true,
  })
  message: string;

  @ApiProperty({
    required: false,
  })
  context?: string;
}
