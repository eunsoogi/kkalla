import { Injectable, NotFoundException } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';

import { RoleDto } from './dto/role.dto';
import { Role } from './entities/role.entity';

@Injectable()
export class RoleService {
  constructor(private readonly i18n: I18nService) {}

  public async findAll(): Promise<Role[]> {
    return Role.find();
  }

  public async findById(id: string): Promise<Role> {
    const role = await Role.findOne({ where: { id } });

    if (!role) {
      throw new NotFoundException(
        this.i18n.t('logging.role.error.not_found', {
          args: { id },
        }),
      );
    }

    return role;
  }

  public async create(roleDto: RoleDto): Promise<Role> {
    const role = Role.create({
      name: roleDto.name,
    });

    await role.save();
    return role;
  }

  public async update(id: string, roleDto: RoleDto): Promise<Role> {
    const role = await this.findById(id);

    Object.assign(role, roleDto);
    await role.save();

    return role;
  }

  public async delete(id: string): Promise<void> {
    const role = await this.findById(id);
    await role.remove();
  }
}
