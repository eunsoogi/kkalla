import { PaginatedItem } from './item.interface';

export interface Role {
  id: string;
  name: string;
  permissions: string[];
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export const initialPaginatedState: PaginatedItem<Role> = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
};
