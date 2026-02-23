import { Role } from '../../role/entities/role.entity';

export class RoleDto {
  id: string;
  name: string;
  permissions: string[];

  /**
   * Handles from in the authentication workflow.
   * @param role - Input value for role.
   * @returns Result produced by the authentication flow.
   */
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
