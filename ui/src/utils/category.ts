import { Category } from '@/enums/category.enum';
import { Permission } from '@/shared/types/permission.types';

/**
 * Retrieves category text for the dashboard UI flow.
 * @param category - Input value for category.
 * @param t - Input value for t.
 * @returns Result produced by the dashboard UI flow.
 */
export const getCategoryText = (category: string, t: (key: string) => string) => {
  switch (category) {
    case Category.COIN_MAJOR:
      return t('category.coin.major');
    case Category.COIN_MINOR:
      return t('category.coin.minor');
    case Category.NASDAQ:
      return t('category.nasdaq');
    default:
      return category;
  }
};

/**
 * Retrieves category permission for the dashboard UI flow.
 * @param category - Input value for category.
 * @returns Result produced by the dashboard UI flow.
 */
export const getCategoryPermission = (category: Category): Permission | null => {
  switch (category) {
    case Category.COIN_MAJOR:
      return Permission.TRADE_COIN_MAJOR;
    case Category.COIN_MINOR:
      return Permission.TRADE_COIN_MINOR;
    case Category.NASDAQ:
      return Permission.TRADE_NASDAQ;
    default:
      return null;
  }
};
