import { Balances } from 'ccxt';

import { Inference } from '../inference/entities/inference.entity';
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
  inference?: Inference;
}

export interface TradeData {
  ticker: string;
  type: OrderTypes;
  amount: number;
  profit: number;
  inference: Inference;
}
