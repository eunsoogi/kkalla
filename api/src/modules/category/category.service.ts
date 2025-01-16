import { Injectable } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';

import { Permission } from '../permission/permission.enum';
import { User } from '../user/entities/user.entity';
import { Category } from './category.enum';
import { UserCategory } from './entities/user-category.entity';

@Injectable()
export class CategoryService {
  constructor(private readonly i18n: I18nService) {}

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

  public checkCategoryPermission(user: User, category: Category): boolean {
    const userPermissions = user.roles.flatMap((role) => role.permissions || []);
    const requiredPermission = this.getRequiredCategoryPermission(category);
    return userPermissions.includes(requiredPermission);
  }

  public getRequiredCategoryPermission(category: Category): Permission {
    switch (category) {
      case Category.NASDAQ:
        return Permission.TRADE_NASDAQ;

      case Category.COIN_MAJOR:
        return Permission.TRADE_COIN_MAJOR;

      case Category.COIN_MINOR:
        return Permission.TRADE_COIN_MINOR;

      default:
        throw new Error(
          this.i18n.t('logging.category.unknown', {
            args: { category },
          }),
        );
    }
  }
}
