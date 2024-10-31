import { Balances } from 'ccxt';

import { Inference } from '../inferences/entities/inference.entity';
import { OrderTypes } from '../upbit/upbit.enum';

export interface TradeData {
  type: OrderTypes;
  symbol: string;
  market: string;
  amount: number;
  balances: Balances;
  inference: Inference;
}
