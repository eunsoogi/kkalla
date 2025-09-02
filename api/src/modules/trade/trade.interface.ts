import { Balances } from 'ccxt';

import { BalanceRecommendationData } from '../inference/inference.interface';
import { SortDirection } from '../item/item.enum';
import { OrderTypes } from '../upbit/upbit.enum';

export interface TradeFilter {
  ticker?: string;
  type?: OrderTypes;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  sortDirection?: SortDirection;
}

export interface TradeRequest {
  ticker: string;
  diff: number;
  balances: Balances;
  inference?: BalanceRecommendationData;
}

export interface TradeData {
  ticker: string;
  type: OrderTypes;
  amount: number;
  profit: number;
  inference?: BalanceRecommendationData;
}
