import { Category } from '../category/category.enum';

export interface HoldingLedgerItem {
  symbol: string;
  category: Category;
  index: number;
}

export interface HoldingLedgerRemoveItem {
  symbol: string;
  category: Category;
}
