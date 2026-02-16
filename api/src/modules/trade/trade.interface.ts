import { Balances } from 'ccxt';

import { SortDirection } from '../item/item.enum';
import { BalanceRecommendationData } from '../rebalance/rebalance.interface';
import { OrderTypes } from '../upbit/upbit.enum';

export interface TradeFilter {
  symbol?: string;
  type?: OrderTypes;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  sortDirection?: SortDirection;
}

export interface TradeRequest {
  symbol: string;
  diff: number;
  balances: Balances;
  marketPrice?: number;
  inference?: BalanceRecommendationData;
}

export interface TradeData {
  symbol: string;
  type: OrderTypes;
  amount: number;
  profit: number;
  inference?: BalanceRecommendationData;
}
