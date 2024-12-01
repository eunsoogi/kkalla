import { OHLCV } from 'ccxt';

import { OrderTypes } from './upbit.enum';

export interface UpbitConfigData {
  accessKey: string;
  secretKey: string;
}

export interface CandleRequest {
  symbol: string;
  market: string;
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
  symbol: string;
  market: string;
  type: () => OrderTypes;
  orderRatio: number;
}
