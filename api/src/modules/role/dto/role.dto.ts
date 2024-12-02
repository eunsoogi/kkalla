import { ApiProperty } from '@nestjs/swagger';

import { Role } from '../entities/role.entity';

export class RoleDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    example: 'ADMIN',
  })
  name: string;

  constructor(role: Role) {
    this.id = role.id;
    this.name = role.name;
  }
}
