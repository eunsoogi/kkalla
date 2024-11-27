import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';

import { Role } from '../entities/role.entity';
import { Permission } from '../user.enum';

export class RoleSeeder implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    const roleRepository = dataSource.getRepository(Role);

    const defaultRoles = [
      {
        name: 'ADMIN',
        description: 'System administrator with full access',
        permissions: Object.values(Permission),
      },
      {
        name: 'USER',
        description: 'Regular user with basic access',
      },
    ];

    for (const roleData of defaultRoles) {
      const existingRole = await roleRepository.findOne({
        where: { name: roleData.name },
      });

      if (!existingRole) {
        const role = roleRepository.create(roleData);
        await roleRepository.save(role);
      }
    }
  }
}
