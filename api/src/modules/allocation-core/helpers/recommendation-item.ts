import { Category } from '@/modules/category/category.enum';

interface SymbolCategoryItem {
  symbol: string;
  category: string | number;
}

interface FilterRecommendationItemsResult<T> {
  items: T[];
  filteredSymbols: string[];
}

export interface CategoryItemCountConfig {
  coinMajorItemCount: number;
  coinMinorItemCount: number;
  nasdaqItemCount: number;
}

interface UserCategoryLike {
  category: Category;
}

export function filterUniqueNonBlacklistedItems<T extends SymbolCategoryItem>(
  items: T[],
  blacklist: SymbolCategoryItem[],
): FilterRecommendationItemsResult<T> {
  const blacklistKeySet = new Set(blacklist.map((item) => `${item.symbol}:${item.category}`));
  const firstIndexBySymbol = new Map<string, number>();
  const filteredSymbols = new Set<string>();

  items.forEach((item, index) => {
    if (!firstIndexBySymbol.has(item.symbol)) {
      firstIndexBySymbol.set(item.symbol, index);
    }
  });

  const filteredItems = items.filter((item, index) => {
    if (index !== firstIndexBySymbol.get(item.symbol)) {
      return false;
    }

    const isBlacklisted = blacklistKeySet.has(`${item.symbol}:${item.category}`);
    if (isBlacklisted) {
      filteredSymbols.add(item.symbol);
    }

    return !isBlacklisted;
  });

  return {
    items: filteredItems,
    filteredSymbols: Array.from(filteredSymbols),
  };
}

export function getItemCountByCategory(category: Category, config: CategoryItemCountConfig): number {
  switch (category) {
    case Category.COIN_MAJOR:
      return config.coinMajorItemCount;
    case Category.COIN_MINOR:
      return config.coinMinorItemCount;
    case Category.NASDAQ:
      return config.nasdaqItemCount;
  }

  return 0;
}

export function getMaxAuthorizedItemCount<TUser>(
  user: TUser,
  categories: Category[],
  hasPermission: (user: TUser, category: Category) => boolean,
  config: CategoryItemCountConfig,
): number {
  const authorizedCategories = categories.filter((category) => hasPermission(user, category));
  if (authorizedCategories.length < 1) {
    return 0;
  }

  return Math.max(...authorizedCategories.map((category) => getItemCountByCategory(category, config)));
}

export function applyHeldAssetFlags<
  T extends {
    symbol: string;
    category: string | number;
    hasStock: boolean;
  },
>(inferences: T[], holdingItems: SymbolCategoryItem[]): T[] {
  const heldSymbolSet = new Set(holdingItems.map((item) => `${item.symbol}:${item.category}`));

  return inferences.map((inference) => ({
    ...inference,
    hasStock: heldSymbolSet.has(`${inference.symbol}:${inference.category}`),
  }));
}

export function filterAuthorizedRecommendationItems<TUser, TItem extends { category: Category }>(
  user: TUser,
  items: TItem[],
  enabledCategories: UserCategoryLike[],
  hasPermission: (user: TUser, category: Category) => boolean,
): TItem[] {
  return items.filter(
    (item) =>
      hasPermission(user, item.category) &&
      enabledCategories.some((enabledCategory) => enabledCategory.category === item.category),
  );
}
