import { Category } from '@/enums/category.enum';

import { CursorItem, PaginatedItem } from './item.interface';

export interface Inference {
  id: string;
  seq: number;
  ticker: string;
  rate: number;
  category: Category;
  reason: string;
  createdAt?: string;
  updatedAt?: string;
}

export const initialPaginatedState: PaginatedItem<Inference> = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
};

export const initialCursorState: CursorItem<Inference> = {
  success: true,
  message: null,
  items: [],
  nextCursor: null,
  hasNextPage: false,
  total: 0,
};
