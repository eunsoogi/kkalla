import { Seeder } from 'typeorm-extension';

import { Role } from '@/modules/user/entities/role.entity';
import { Permission, UserRole } from '@/modules/user/user.enum';

export class RoleSeeder implements Seeder {
  public async run(): Promise<void> {
    const defaultRoles = [
      {
        name: UserRole.ADMIN,
        description: 'System administrator with full access',
        permissions: Object.values(Permission),
      },
      {
        name: UserRole.USER,
        description: 'Regular user with basic access',
        permissions: [],
      },
    ];

    for (const roleData of defaultRoles) {
      let role = await Role.findOneBy({ name: roleData.name });

      if (!role) {
        role = new Role();
        Object.assign(role, roleData);
        await role.save();
      }
    }
  }
}
