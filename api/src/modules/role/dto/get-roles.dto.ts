import { ApiProperty } from '@nestjs/swagger';

import { GetPaginationDto } from '@/modules/item/dto/get-pagination.dto';

export class GetRolesDto extends GetPaginationDto {
  @ApiProperty({
    required: false,
    example: '',
  })
  search?: string;
}
