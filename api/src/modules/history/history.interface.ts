import { Category } from '../category/category.enum';

export interface HistoryItem {
  symbol: string;
  category: Category;
  index: number;
}
