import { Balances } from 'ccxt';

import { OrderTypes } from './upbit.enum';

export interface UpbitConfigData {
  accessKey: string;
  secretKey: string;
}

export interface CandleRequest {
  ticker: string;
  timeframe: string;
  limit?: number;
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
