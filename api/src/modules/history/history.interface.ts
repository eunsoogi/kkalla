import { Category } from '../category/category.enum';

export interface HistoryItem {
  ticker: string;
  category: Category;
  index: number;
}
