export interface PaginatedItem<T> {
  success: boolean;
  message?: string | null;
  items: T[];
  total: number;
  page: number;
  perPage?: number;
  totalPages: number;
}

export interface CursorItem<T> {
  success: boolean;
  message?: string | null;
  items: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
  total: number;
}
