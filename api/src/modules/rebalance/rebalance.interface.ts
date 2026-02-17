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
  weight?: number;
  confidence?: number;
}

export type BalanceRecommendationAction = 'buy' | 'sell' | 'hold';

export interface BalanceRecommendationData {
  id: string;
  batchId: string;
  symbol: string;
  category: Category;
  intensity: number;
  prevIntensity?: number | null;
  prevModelTargetWeight?: number | null;
  buyScore?: number;
  sellScore?: number;
  modelTargetWeight?: number;
  action?: BalanceRecommendationAction;
  hasStock: boolean;
  weight?: number;
  confidence?: number;
}
