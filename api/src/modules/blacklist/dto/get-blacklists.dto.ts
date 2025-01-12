import { ApiProperty } from '@nestjs/swagger';

import { GetPaginationDto } from '@/modules/item/dto/get-pagination.dto';

export class GetBlacklistsDto extends GetPaginationDto {
  @ApiProperty({
    required: false,
    example: '',
  })
  search?: string;
}
