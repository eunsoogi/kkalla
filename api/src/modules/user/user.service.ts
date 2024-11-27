import { Injectable } from '@nestjs/common';

import { PaginatedItem } from '@/modules/item/item.interface';

import { GetUsersDto } from './dto/get-users.dto';
import { UserDto } from './dto/user.dto';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { UserRole } from './user.enum';
import { UserData } from './user.interface';

@Injectable()
export class UserService {
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

  public async create(data: UserData): Promise<User> {
    const user = new User();

    Object.assign(user, data);

    if (!user.roles?.length) {
      await this.assignDefaultRole(user);
    }

    return user.save();
  }

  private async assignDefaultRole(user: User): Promise<void> {
    const userRole = await Role.findOne({ where: { name: UserRole.USER } });
    if (userRole) {
      user.roles = [userRole];
      await user.save();
    }
  }

  public async paginate(params: GetUsersDto): Promise<PaginatedItem<UserDto>> {
    const users = await User.paginate(params);

    return {
      ...users,
      items: users.items.map((user) => new UserDto(user)),
    };
  }
}
