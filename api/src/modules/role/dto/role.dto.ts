import { ApiProperty } from '@nestjs/swagger';

import { Permission } from '../../permission/permission.enum';
import { Role } from '../entities/role.entity';

export class RoleDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

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

  @ApiProperty({
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
  })
  updatedAt: Date;

  constructor(role: Role) {
    this.id = role.id;
    this.name = role.name;
    this.description = role.description;
    this.permissions = role.permissions;
    this.createdAt = role.createdAt;
    this.updatedAt = role.updatedAt;
  }
}
