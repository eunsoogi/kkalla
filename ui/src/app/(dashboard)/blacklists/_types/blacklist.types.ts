import { PaginatedItem } from '@/shared/types/pagination.types';

export interface Blacklist {
  id: string;
  symbol: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export const initialPaginatedState: PaginatedItem<Blacklist> = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
};
