import { Category as CategoryEnum } from '@/enums/category.enum';

export interface Category {
  id: string;
  category: CategoryEnum;
  enabled: boolean;
}
