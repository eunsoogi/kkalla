import { Category } from '@/enums/category.enum';

import { CursorItem, PaginatedItem } from './item.interface';

export interface BalanceRecommendation {
  id: string;
  seq: number;
  symbol: string;
  rate: number;
  category: Category;
  reason: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketRecommendation {
  id: string;
  seq: number;
  symbol: string;
  weight: number;
  reason: string;
  confidence: number;
  batchId: string;
  createdAt?: string;
  updatedAt?: string;
}

export const initialPaginatedState: PaginatedItem<any> = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
};

export const initialCursorState: CursorItem<any> = {
  success: true,
  message: null,
  items: [],
  nextCursor: null,
  hasNextPage: false,
  total: 0,
};
