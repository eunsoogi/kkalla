export interface ItemRequest {
  page: number;
  perPage: number;
}

export interface CursorRequest<C> {
  cursor?: C;
  limit: number;
  skip: boolean;
}

export class PaginatedItem<T> {
  items: T[];
  total: number = 0;
  page: number = 1;
  perPage: number;
  totalPages: number = 1;
}

export interface CursorItem<T, C> {
  items: T[];
  nextCursor: C;
  hasNextPage: boolean;
  total: number;
}
