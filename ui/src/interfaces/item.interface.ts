import { State } from './state.interface';

export interface PaginatedItem<T> extends State {
  items: T[];
  total: number;
  page: number;
  perPage?: number;
  totalPages: number;
}

export interface CursorItem<T> extends State {
  items: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
  total: number;
}
