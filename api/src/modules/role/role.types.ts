import { SortDirection } from '../item/item.enum';
import { Permission } from '../permission/permission.enum';

export interface RoleFilter {
  search?: string;
  sortDirection?: SortDirection;
}

export interface RoleData {
  name: string;
  description?: string;
  permissions: Permission[];
}
