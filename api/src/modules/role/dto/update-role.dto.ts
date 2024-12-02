import { ApiProperty } from '@nestjs/swagger';

import { Permission } from '../../permission/permission.enum';

export class UpdateRoleDto {
  @ApiProperty({
    example: 'admin',
  })
  name: string;

  @ApiProperty({
    example: 'Role for administrative users',
    required: false,
  })
  description?: string;

  @ApiProperty({
    example: [Permission.VIEW_USERS, Permission.MANAGE_USERS],
    type: [String],
    enum: Permission,
  })
  permissions: Permission[];
}
