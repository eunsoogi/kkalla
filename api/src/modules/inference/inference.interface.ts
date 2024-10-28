import { Feargreed } from '../feargreed/feargreed.interface';
import { News } from '../news/news.interface';
import { Candle } from '../upbit/upbit.interface';

export interface InferenceData {
  krwBalance: number;
  coinBalance: number;
  candles: Candle[];
  news: News[];
  feargreed: Feargreed;
}

export interface InferenceResult {
  decision: string;
  accuracy: number;
  amount: number;
  reason: string;
}
