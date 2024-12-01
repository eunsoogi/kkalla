import { TradeTypes } from '../enums/trade.enum';
import { Inference } from './inference.interface';
import { PaginatedItem } from './item.interface';

export interface Trade {
  id: number;
  type: TradeTypes;
  ticker: string;
  amount: number;
  balances: object;
  inference: Inference;
  createdAt: Date;
  updatedAt: Date;
}

export const initialState: PaginatedItem<Trade> = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
};
