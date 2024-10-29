export type ItemResponse<T> = {
  success: boolean;
  message?: string | null;
  items: T[];
  total: number;
  page: number;
  perPage?: number;
  totalPages: number;
};
