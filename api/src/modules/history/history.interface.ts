import { Category } from '../category/category.enum';

export interface HistoryItem {
  symbol: string;
  category: Category;
  index: number;
}

export interface HistoryRemoveItem {
  symbol: string;
  category: Category;
}
