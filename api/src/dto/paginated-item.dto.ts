export class PaginatedItemDto<T> {
  items: T[];
  total: number = 0;
  page: number = 1;
  perPage: number;
  totalPages: number = 1;
}
