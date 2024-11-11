import { Feargreed } from '../feargreed/feargreed.interface';
import { News } from '../news/news.interface';
import { Candle } from '../upbit/upbit.interface';
import { Inference } from './entities/inference.entity';
import { InferenceDecisionTypes } from './inference.enum';

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
  prevInferences: Inference[];
}

export interface InferenceResult {
  items: InferenceData[];
}

export interface InferenceData {
  symbol: string;
  decision: InferenceDecisionTypes;
  rate: number;
  cashMoreThan: number;
  cashLessThan: number;
  reason: string;
  reflection: string;
}
