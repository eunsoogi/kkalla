import { Feargreed } from '../feargreed/feargreed.interface';
import { News } from '../news/news.interface';
import { Candle } from '../upbit/upbit.interface';
import { InferenceDecisionTypes } from './inference.enum';

export interface InferenceFilter {
  users?: {
    id: string;
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
  inferenceLimit: number;
}

export interface InferenceMessage {
  candles: Candle[];
  news: News[];
  feargreed: Feargreed;
  firechart: string;
}

export interface InferenceData {
  decisions: InferenceDecisionData[];
  symbol: string;
  reason: string;
}

export interface InferenceDecisionData {
  decision: InferenceDecisionTypes;
  orderRatio: number;
  weightLowerBound: number;
  weightUpperBound: number;
  reason: string;
}

export interface InferenceItem extends InferenceDecisionData {
  symbol: string;
}

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
}
