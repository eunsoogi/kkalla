import { Injectable } from '@nestjs/common';

import { CategoryService } from '@/modules/category/category.service';
import { User } from '@/modules/user/entities/user.entity';

import { getMaxAuthorizedItemCount } from './helpers/recommendation-item';

@Injectable()
export class AllocationSlotService {
  constructor(private readonly categoryService: CategoryService) {}

  public async resolveAuthorizedSlotCount(user: User): Promise<number> {
    const enabledCategories = await this.categoryService.findEnabledByUser(user);

    return getMaxAuthorizedItemCount(
      user,
      enabledCategories.map((enabledCategory) => enabledCategory.category),
      (targetUser, category) => this.categoryService.checkCategoryPermission(targetUser, category),
    );
  }
}
