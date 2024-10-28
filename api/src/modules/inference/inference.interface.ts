import { Feargreed } from '../feargreed/feargreed.interface';
import { News } from '../news/news.interface';
import { Candle } from '../upbit/upbit.interface';
import { Inference } from './entities/inference.entity';

export enum InferenceDicisionTypes {
  BUY = 'buy',
  SELL = 'sell',
  HOLD = 'hold',
}

export interface InferenceData {
  candles: Candle[];
  news: News[];
  feargreed: Feargreed;
  prevInferences: Inference[];
}

export interface InferenceResult {
  decision: InferenceDicisionTypes;
  rate: number;
  reason: string;
  reflection: string;
}
