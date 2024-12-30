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

export interface CachedInferenceMessageRequest {
  category: InferenceCategory;
  newsLimit: number;
}

export interface InferenceMessageRequest {
  ticker: string;
  category: InferenceCategory;
  candles: {
    '1d': number;
    '4h': number;
    '1h': number;
    '15m': number;
    '5m': number;
    '1m': number;
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
