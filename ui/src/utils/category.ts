import { Category } from '@/enums/category.enum';
import { Permission } from '@/interfaces/permission.interface';

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
