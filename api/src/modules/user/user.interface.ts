import { SortDirection } from '../item/item.enum';

export interface UserFilter {
  search?: string;
  sortDirection?: SortDirection;
}

export interface UserData {
  email: string;
}
