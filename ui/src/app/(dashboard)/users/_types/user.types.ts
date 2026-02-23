import { Role } from '@/shared/types/role.types';
import { PaginatedItem } from '@/shared/types/pagination.types';

export interface User {
  id: string;
  email: string;
  roles: Role[];
  createdAt: string;
  updatedAt: string;
}

export const initialPaginatedState: PaginatedItem<User> = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
};
