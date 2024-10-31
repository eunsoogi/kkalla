export interface ItemRequest {
  page: number;
  perPage: number;
}

export interface CursorRequest {
  cursor: string;
  limit: number;
}

export class PaginatedItem<T> {
  items: T[];
  total: number = 0;
  page: number = 1;
  perPage: number;
  totalPages: number = 1;
}

export interface CursorItem<T> {
  items: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
  total: number;
}
