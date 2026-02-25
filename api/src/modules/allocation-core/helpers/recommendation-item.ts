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

export const DEFAULT_CATEGORY_ITEM_COUNT_CONFIG: Readonly<CategoryItemCountConfig> = Object.freeze({
  coinMajorItemCount: 2,
  coinMinorItemCount: 5,
  nasdaqItemCount: 0,
});

interface UserCategoryLike {
  category: Category;
}

/**
 * Transforms unique non blacklisted items for the allocation recommendation flow.
 * @param items - Collection of items used by the allocation recommendation flow.
 * @param blacklist - Collection of items used by the allocation recommendation flow.
 * @returns Result produced by the allocation recommendation flow.
 */
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

/**
 * Retrieves item count by category for the allocation recommendation flow.
 * @param category - Input value for category.
 * @param config - Configuration for the allocation recommendation flow.
 * @returns Computed numeric value for the operation.
 */
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

/**
 * Retrieves max authorized item count for the allocation recommendation flow.
 * @param user - User identifier related to this operation.
 * @param categories - Input value for categories.
 * @param hasPermission - Input value for has permission.
 * @param config - Configuration for the allocation recommendation flow.
 * @returns Computed numeric value for the operation.
 */
export function getMaxAuthorizedItemCount<TUser>(
  user: TUser,
  categories: Category[],
  hasPermission: (user: TUser, category: Category) => boolean,
  config: CategoryItemCountConfig = DEFAULT_CATEGORY_ITEM_COUNT_CONFIG,
): number {
  const authorizedCategories = categories.filter((category) => hasPermission(user, category));
  if (authorizedCategories.length < 1) {
    return 0;
  }

  return Math.max(...authorizedCategories.map((category) => getItemCountByCategory(category, config)));
}

/**
 * Handles held asset flags in the allocation recommendation workflow.
 * @param inferences - Input value for inferences.
 * @param holdingItems - Collection of items used by the allocation recommendation flow.
 * @returns Processed collection for downstream workflow steps.
 */
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

/**
 * Transforms authorized recommendation items for the allocation recommendation flow.
 * @param user - User identifier related to this operation.
 * @param items - Collection of items used by the allocation recommendation flow.
 * @param enabledCategories - Input value for enabled categories.
 * @param hasPermission - Input value for has permission.
 * @returns Processed collection for downstream workflow steps.
 */
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
