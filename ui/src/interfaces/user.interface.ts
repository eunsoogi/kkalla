import { PaginatedItem } from './item.interface';

export interface User {
  id: string;
  email: string;
  roles: {
    id: string;
    name: string;
  }[];
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
