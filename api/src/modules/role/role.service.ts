import { Injectable, NotFoundException } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';

import { PaginatedItem } from '../item/item.types';
import { GetRolesDto } from './dto/get-roles.dto';
import { RoleDto } from './dto/role.dto';
import { Role } from './entities/role.entity';
import { RoleData } from './role.types';

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

  public async create(data: RoleData): Promise<Role> {
    const role = new Role();
    Object.assign(role, data);
    return role.save();
  }

  public async update(id: string, data: RoleData): Promise<Role> {
    const role = await this.findById(id);
    Object.assign(role, data);
    return role.save();
  }

  public async delete(id: string): Promise<void> {
    const role = await this.findById(id);
    await role.remove();
  }

  public async paginate(params: GetRolesDto): Promise<PaginatedItem<RoleDto>> {
    const roles = await Role.paginate(params);

    return {
      ...roles,
      items: roles.items.map((role) => new RoleDto(role)),
    };
  }
}
