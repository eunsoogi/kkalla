import { ItemResponse } from '@/interfaces/item.interface';

import { TradeTypes } from '../enums/trade.enum';
import { Inference } from './inference.interface';

export interface Trade {
  id: number;
  type: TradeTypes;
  symbol: string;
  market: string;
  amount: number;
  balances: object;
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