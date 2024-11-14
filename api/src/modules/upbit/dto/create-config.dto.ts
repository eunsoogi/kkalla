import { ApiProperty } from '@nestjs/swagger';

export class CreateUpbitConfigDto {
  @ApiProperty({
    required: true,
  })
  accessKey: string;

  @ApiProperty({
    required: true,
  })
  secretKey: string;
}
