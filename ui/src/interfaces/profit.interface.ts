import { PaginatedItem } from './item.interface';

export interface ProfitData {
  email: string;
  profit: number;
}

export const initialPaginatedState: PaginatedItem<ProfitData> = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
};
