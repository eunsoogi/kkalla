import { Injectable, NotFoundException } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';

import { PaginatedItem } from '@/modules/item/item.interface';

import { RoleService } from '../role/role.service';
import { GetUsersDto } from './dto/get-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { User } from './entities/user.entity';
import { UserRole } from './user.enum';
import { UserData } from './user.interface';

@Injectable()
export class UserService {
  constructor(
    private readonly i18n: I18nService,
    private readonly roleService: RoleService,
  ) {}

  public async findById(id: string): Promise<User> {
    const user = await User.findOne({
      where: [{ id }, { legacyId: id }],
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(
        this.i18n.t('logging.user.error.not_found', {
          args: { id },
        }),
      );
    }

    return user;
  }

  public async findOrCreate(data: UserData): Promise<User> {
    const user = await User.findByEmail(data.email);

    if (user) {
      if (!user.roles?.length) {
        await this.assignDefaultRole(user);
      }

      return user;
    }

    return this.create(data);
  }

  private async assignDefaultRole(user: User): Promise<void> {
    const roles = await this.roleService.findAll();
    const userRole = roles.find((role) => role.name === UserRole.USER);

    if (userRole) {
      user.roles = [userRole];
      await user.save();
    }
  }

  public async create(data: UserData): Promise<User> {
    const user = new User();
    Object.assign(user, data);

    if (!user.roles?.length) {
      await this.assignDefaultRole(user);
    }

    return user.save();
  }

  public async update(id: string, data: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    Object.assign(user, data);
    user.updatedAt = new Date();

    return user.save();
  }

  public async paginate(params: GetUsersDto): Promise<PaginatedItem<UserDto>> {
    const users = await User.paginate(params);

    return {
      ...users,
      items: users.items.map((user) => new UserDto(user)),
    };
  }
}
