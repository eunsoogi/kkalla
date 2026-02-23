import { PaginatedItem } from '@/shared/types/pagination.types';

export interface ProfitData {
  email: string;
  profit: number;
  todayProfit?: number;
}

export const initialPaginatedState: PaginatedItem<ProfitData> = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
};
