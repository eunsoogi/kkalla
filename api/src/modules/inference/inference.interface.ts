import { Category } from '../category/category.enum';
import { SortDirection } from '../item/item.enum';

export interface BalanceRecommendationFilter {
  ticker?: string;
  category?: Category;
  startDate?: Date;
  endDate?: Date;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  sortDirection?: SortDirection;
}

export interface MarketRecommendationFilter {
  ticker?: string;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  sortDirection?: SortDirection;
}

export interface RecentBalanceRecommendationRequest {
  ticker: string;
  createdAt: Date;
  count: number;
}

export interface InferenceMessageRequest {
  ticker: string;
  category: Category;
  candles: {
    '1d': number;
    '4h': number;
    '1h': number;
    '15m': number;
  };
  newsLimit: number;
  newsImportanceLower: number;
  recentLimit: number;
  recentDateLimit: number;
}

export interface CandleRequest {
  ticker: string;
  timeframe: string;
  limit: number;
}

export interface RecommendationItem {
  ticker: string;
  category: Category;
  hasStock: boolean;
}

export interface MarketRecommendation {
  symbol: string;
  reason: string;
  confidence: number;
  weight: number;
}

export interface MarketRecommendationResponse {
  batchId: string;
  recommendations: MarketRecommendation[];
}
