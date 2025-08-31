import { TradeTypes } from '../enums/trade.enum';
import { BalanceRecommendation } from './inference.interface';
import { CursorItem, PaginatedItem } from './item.interface';
import { State } from './state.interface';

export interface Trade {
  id: number;
  type: TradeTypes;
  ticker: string;
  amount: number;
  profit: number;
  inference: BalanceRecommendation;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfitResponse extends State {
  data?: {
    profit: number;
  };
}

export const initialState: PaginatedItem<Trade> = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
};

export const initialCursorState: CursorItem<Trade> = {
  success: true,
  message: null,
  items: [],
  nextCursor: null,
  hasNextPage: false,
  total: 0,
};
