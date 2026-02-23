import { Category } from '@/modules/category/category.enum';

import {
  applyHeldAssetFlags,
  filterAuthorizedRecommendationItems,
  filterUniqueNonBlacklistedItems,
  getItemCountByCategory,
  getMaxAuthorizedItemCount,
} from './recommendation-item';

describe('filterUniqueNonBlacklistedItems', () => {
  it('should keep first symbol, drop duplicates, and exclude blacklisted symbols', () => {
    const items = [
      { symbol: 'BTC/KRW', category: Category.COIN_MAJOR },
      { symbol: 'BTC/KRW', category: Category.COIN_MINOR },
      { symbol: 'ETH/KRW', category: Category.COIN_MAJOR },
      { symbol: 'XRP/KRW', category: Category.COIN_MINOR },
    ];
    const blacklist = [
      { symbol: 'ETH/KRW', category: Category.COIN_MAJOR },
      { symbol: 'IGNORED/KRW', category: Category.COIN_MINOR },
    ];

    const result = filterUniqueNonBlacklistedItems(items, blacklist);

    expect(result.items).toEqual([
      { symbol: 'BTC/KRW', category: Category.COIN_MAJOR },
      { symbol: 'XRP/KRW', category: Category.COIN_MINOR },
    ]);
    expect(result.filteredSymbols).toEqual(['ETH/KRW']);
  });
});

describe('recommendation-item count helpers', () => {
  const config = {
    coinMajorItemCount: 2,
    coinMinorItemCount: 5,
    nasdaqItemCount: 3,
  };

  it('should resolve count by category', () => {
    expect(getItemCountByCategory(Category.COIN_MAJOR, config)).toBe(2);
    expect(getItemCountByCategory(Category.COIN_MINOR, config)).toBe(5);
    expect(getItemCountByCategory(Category.NASDAQ, config)).toBe(3);
  });

  it('should resolve max authorized count', () => {
    const user = { id: 'user-1' };
    const categories = [Category.COIN_MAJOR, Category.COIN_MINOR, Category.NASDAQ];
    const hasPermission = (_user: { id: string }, category: Category) => category !== Category.NASDAQ;

    const max = getMaxAuthorizedItemCount(user, categories, hasPermission, config);

    expect(max).toBe(5);
  });

  it('should return 0 when no categories are authorized', () => {
    const user = { id: 'user-1' };
    const categories = [Category.COIN_MAJOR];
    const max = getMaxAuthorizedItemCount(user, categories, () => false, config);
    expect(max).toBe(0);
  });

  it('should apply hasStock from user holdings items', () => {
    const inferences = [
      { symbol: 'BTC/KRW', category: Category.COIN_MAJOR, hasStock: false },
      { symbol: 'ETH/KRW', category: Category.COIN_MINOR, hasStock: false },
    ];
    const holdingItems = [{ symbol: 'ETH/KRW', category: Category.COIN_MINOR }];

    const result = applyHeldAssetFlags(inferences, holdingItems);

    expect(result).toEqual([
      { symbol: 'BTC/KRW', category: Category.COIN_MAJOR, hasStock: false },
      { symbol: 'ETH/KRW', category: Category.COIN_MINOR, hasStock: true },
    ]);
  });

  it('should filter recommendations by enabled categories and permissions', () => {
    const user = { id: 'user-1' };
    const items = [
      { category: Category.COIN_MAJOR, symbol: 'BTC/KRW' },
      { category: Category.COIN_MINOR, symbol: 'XRP/KRW' },
      { category: Category.NASDAQ, symbol: 'AAPL' },
    ];
    const enabledCategories = [{ category: Category.COIN_MAJOR }, { category: Category.NASDAQ }];
    const hasPermission = (_user: { id: string }, category: Category) => category !== Category.NASDAQ;

    const result = filterAuthorizedRecommendationItems(user, items, enabledCategories, hasPermission);

    expect(result).toEqual([{ category: Category.COIN_MAJOR, symbol: 'BTC/KRW' }]);
  });
});
