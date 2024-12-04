import { SortDirection } from '../item/item.enum';
import { InferenceCategory } from './inference.enum';

export interface InferenceFilter {
  ticker?: string;
  category?: InferenceCategory;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  sortDirection?: SortDirection;
}

export interface InferenceMessageRequest {
  ticker: string;
  category: InferenceCategory;
  candles: {
    '15m': number;
    '1h': number;
    '4h': number;
    '1d': number;
  };
  newsLimit: number;
}

export interface InferenceItem {
  ticker: string;
  category: InferenceCategory;
}

export interface InferenceData extends InferenceItem {
  rate: number;
  reason: string;
}

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
}
