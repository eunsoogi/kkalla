import { Category } from '../category/category.enum';
import { SortDirection } from '../item/item.enum';

export interface BalanceRecommendationFilter {
  symbol?: string;
  category?: Category;
  startDate?: Date;
  endDate?: Date;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  sortDirection?: SortDirection;
}

export interface RecentBalanceRecommendationRequest {
  symbol: string;
  createdAt: Date;
  count: number;
}

export interface RecommendationItem {
  symbol: string;
  category: Category;
  hasStock: boolean;
}

export interface BalanceRecommendationData {
  id: string;
  batchId: string;
  symbol: string;
  category: Category;
  rate: number;
  hasStock: boolean;
}
