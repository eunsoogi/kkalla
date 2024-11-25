import { Decision } from './decision.interface';
import { CursorItem, PaginatedItem } from './item.interface';

export interface Inference {
  id: string;
  seq: number;
  symbol: string;
  decisions: Decision[];
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
