import { Injectable } from '@nestjs/common';

import { CreateUserDto } from './dto/create-user.dto';
import { GetUserDto } from './dto/find-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  public async findOrCreate(getUserDto: GetUserDto): Promise<User> {
    return (await User.findByEmail(getUserDto.email)) ?? User.create({ ...getUserDto });
  }

  public async create(createUserDto: CreateUserDto): Promise<User> {
    const user = new User();

    Object.entries(createUserDto).forEach(([key, value]) => (user[key] = value));

    return user.save();
  }
}
