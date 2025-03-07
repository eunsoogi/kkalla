import { Category } from '../category/category.enum';
import { SortDirection } from '../item/item.enum';

export interface InferenceFilter {
  ticker?: string;
  category?: Category;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  sortDirection?: SortDirection;
}

export interface RecentInferenceRequest {
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
    '5m': number;
  };
  newsLimit: number;
  recentLimit: number;
  recentDateLimit: number;
}

export interface CandleRequest {
  ticker: string;
  timeframe: string;
  limit: number;
}

export interface InferenceItem {
  ticker: string;
  category: Category;
  hasStock: boolean;
}

export interface InferenceData extends InferenceItem {
  reason: string;
  rate: number;
}
export interface RecentInferenceResult {
  timestamp: Date;
  rate: number;
}
