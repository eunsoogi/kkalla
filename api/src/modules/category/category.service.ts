import { Injectable } from '@nestjs/common';

import { User } from '../user/entities/user.entity';
import { Category } from './category.enum';
import { UserCategory } from './entities/user-category.entity';

@Injectable()
export class CategoryService {
  public async findAllByUser(user: User): Promise<UserCategory[]> {
    return UserCategory.find({
      where: { user: { id: user.id } },
    });
  }

  public async findEnabledByUser(user: User): Promise<UserCategory[]> {
    return UserCategory.find({
      where: { user: { id: user.id }, enabled: true },
    });
  }

  public async create(user: User, category: Category): Promise<UserCategory> {
    const userCategory = UserCategory.create({
      user,
      category,
      enabled: true,
    });

    return userCategory.save();
  }

  public async update(user: User, category: Category, enabled: boolean): Promise<UserCategory> {
    const userCategory = await UserCategory.findOne({
      where: { user: { id: user.id }, category },
    });

    if (!userCategory) {
      return this.create(user, category);
    }

    userCategory.enabled = enabled;
    return userCategory.save();
  }

  public async remove(user: User, category: Category): Promise<void> {
    await UserCategory.delete({
      user: { id: user.id },
      category,
    });
  }
}
