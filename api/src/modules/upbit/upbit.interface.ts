import { OrderTypes } from './upbit.enum';

export interface CandleRequest {
  symbol: string;
  market: string;
  candles: {
    m15: number;
    h1: number;
    h4: number;
    d1: number;
  };
}

export interface Candle {
  market: string;
  timestamp: Date;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number;
  unit: number;
}

export class OrderRequest {
  symbol: string;
  market: string;
  type: OrderTypes;
  rate: number;
}