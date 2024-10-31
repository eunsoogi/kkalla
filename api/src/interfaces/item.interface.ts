export interface ItemRequest {
  page: number;
  perPage: number;
}

export class PaginatedItem<T> {
  items: T[];
  total: number = 0;
  page: number = 1;
  perPage: number;
  totalPages: number = 1;
}
