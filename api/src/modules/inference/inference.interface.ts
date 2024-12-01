import { DecisionTypes } from '../decision/decision.enum';
import { DecisionData } from '../decision/decision.interface';
import { SortDirection } from '../item/item.enum';
import { InferenceCategory } from './inference.enum';

export interface InferenceFilter {
  decision?: DecisionTypes;
  sortDirection?: SortDirection;
  category?: InferenceCategory;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  users?: {
    id?: string;
  };
}

export interface InferenceMessageRequest {
  market: string;
  symbol: string;
  candles: {
    '15m': number;
    '1h': number;
    '4h': number;
    '1d': number;
  };
  newsLimit: number;
}

export interface InferenceData {
  ticker: string;
  category: InferenceCategory;
  decisions: DecisionData[];
  reason: string;
}

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
}
