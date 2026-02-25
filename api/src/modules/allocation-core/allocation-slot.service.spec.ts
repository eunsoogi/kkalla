import { Category } from '@/modules/category/category.enum';

import { AllocationSlotService } from './allocation-slot.service';

describe('AllocationSlotService', () => {
  let service: AllocationSlotService;
  let categoryService: {
    findEnabledByUser: jest.Mock;
    checkCategoryPermission: jest.Mock;
  };

  beforeEach(() => {
    categoryService = {
      findEnabledByUser: jest.fn().mockResolvedValue([]),
      checkCategoryPermission: jest.fn().mockReturnValue(true),
    };

    service = new AllocationSlotService(categoryService as any);
  });

  it('should resolve 2 slots when only coin major is enabled and authorized', async () => {
    categoryService.findEnabledByUser.mockResolvedValue([{ category: Category.COIN_MAJOR }]);

    const count = await service.resolveAuthorizedSlotCount({ id: 'user-1', roles: [] } as any);

    expect(count).toBe(2);
  });

  it('should resolve 5 slots when only coin minor is enabled and authorized', async () => {
    categoryService.findEnabledByUser.mockResolvedValue([{ category: Category.COIN_MINOR }]);

    const count = await service.resolveAuthorizedSlotCount({ id: 'user-1', roles: [] } as any);

    expect(count).toBe(5);
  });

  it('should resolve 5 slots when both categories are enabled and authorized', async () => {
    categoryService.findEnabledByUser.mockResolvedValue([
      { category: Category.COIN_MAJOR },
      { category: Category.COIN_MINOR },
    ]);

    const count = await service.resolveAuthorizedSlotCount({ id: 'user-1', roles: [] } as any);

    expect(count).toBe(5);
  });

  it('should resolve 0 slots when enabled categories are not authorized', async () => {
    categoryService.findEnabledByUser.mockResolvedValue([{ category: Category.COIN_MAJOR }]);
    categoryService.checkCategoryPermission.mockReturnValue(false);

    const count = await service.resolveAuthorizedSlotCount({ id: 'user-1', roles: [] } as any);

    expect(count).toBe(0);
  });
});
