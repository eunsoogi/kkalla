import { DecisionTypes } from '../decision/decision.enum';
import { DecisionData } from '../decision/decision.interface';
import { Feargreed } from '../feargreed/feargreed.interface';
import { SortDirection } from '../item/item.enum';
import { News } from '../news/news.interface';
import { Candle } from '../upbit/upbit.interface';

export interface InferenceFilter {
  decision?: DecisionTypes;
  sortDirection?: SortDirection;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
}

export interface InferenceMessageRequest {
  symbol: string;
  market: string;
  candles: {
    m15: number;
    h1: number;
    h4: number;
    d1: number;
  };
  newsLimit: number;
}

export interface InferenceMessage {
  candles: Candle[];
  news: News[];
  feargreed: Feargreed;
  firechart: string;
}

export interface InferenceData {
  decisions: DecisionData[];
  symbol: string;
}

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
}
