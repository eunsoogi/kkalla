import { ItemResponse } from '@/types/item-response.type';

import { Inference } from '../inference/type';

export enum TradeTypes {
  BUY = 'buy',
  SELL = 'sell',
}

export interface BalanceTypes {
  krw: number;
  coin: number;
}

export interface Trade {
  id: number;
  type: TradeTypes;
  symbol: string;
  amount: number;
  balances: BalanceTypes;
  inference: Inference;
  createdAt: Date;
  updatedAt: Date;
}

export const initialState: ItemResponse<Trade> = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
};
