import { Balances, OHLCV } from 'ccxt';

import { OrderTypes } from './upbit.enum';

export interface UpbitConfigData {
  accessKey: string;
  secretKey: string;
}

export interface CandleRequest {
  ticker: string;
  candles: {
    '15m': number;
    '1h': number;
    '4h': number;
    '1d': number;
  };
}

export interface CompactCandle {
  ticker: string;
  series: {
    interval: string;
    data: OHLCV[];
  }[];
}

export interface OrderRequest {
  ticker: string;
  type: OrderTypes;
  amount: number;
}

export interface AdjustOrderRequest {
  ticker: string;
  diff: number;
  balances: Balances;
}
