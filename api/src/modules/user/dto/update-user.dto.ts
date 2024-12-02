import { ApiProperty } from '@nestjs/swagger';

import { RoleDto } from '@/modules/role/dto/role.dto';

export class UpdateUserDto {
  @ApiProperty({
    type: [RoleDto],
  })
  roles: RoleDto[];
}
