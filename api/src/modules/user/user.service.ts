import { Injectable } from '@nestjs/common';

import { User } from './entities/user.entity';
import { UserData } from './user.interface';

@Injectable()
export class UserService {
  public async findOrCreate(data: UserData): Promise<User> {
    return (await User.findByEmail(data.email)) ?? this.create(data);
  }

  public async create(data: UserData): Promise<User> {
    const user = new User();

    Object.assign(user, data);

    return user.save();
  }
}
