import type {
  AllocationMode,
  AllocationRecommendationAction,
  AllocationRecommendationData,
  QueueTradeExecutionMessageV2,
  RecommendationItem,
  TradeExecutionMessageV2,
} from '../allocation-core/allocation-core.types';
import { Category } from '../category/category.enum';
import { SortDirection } from '../item/item.enum';

export interface AllocationRecommendationFilter {
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

export interface RecentAllocationRecommendationRequest {
  symbol: string;
  createdAt: Date;
  count: number;
}

export type {
  AllocationRecommendationAction,
  AllocationRecommendationData,
  AllocationMode,
  RecommendationItem,
  QueueTradeExecutionMessageV2,
  TradeExecutionMessageV2,
};
