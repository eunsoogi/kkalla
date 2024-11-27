import { Role } from '../../user/entities/role.entity';

export class RoleDto {
  id: string;
  name: string;
  permissions: string[];

  static from(role: Role): RoleDto {
    if (!role) {
      return null;
    }

    const dto = new RoleDto();
    dto.id = role.id;
    dto.name = role.name;
    dto.permissions = role.permissions;

    return dto;
  }
}
