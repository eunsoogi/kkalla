import { Balances } from 'ccxt';

import { Feargreed } from '../feargreed/feargreed.interface';
import { News } from '../news/news.interface';
import { Candle } from '../upbit/upbit.interface';
import { Inference } from './entities/inference.entity';
import { InferenceDicisionTypes } from './inference.enum';

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
  balances: Balances;
  candles: Candle[];
  news: News[];
  feargreed: Feargreed;
  prevInferences: Inference[];
}

export interface InferenceResult {
  market: string;
  decision: InferenceDicisionTypes;
  rate: number;
  reason: string;
  reflection: string;
}

export interface InferenceData {
  decision: InferenceDicisionTypes;
  rate: number;
  reason: string;
  reflection: string;
}
