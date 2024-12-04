import { Balances } from 'ccxt';

import { Inference } from '../inference/entities/inference.entity';
import { OrderTypes } from '../upbit/upbit.enum';

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
  balances: Balances;
  inference: Inference;
}
