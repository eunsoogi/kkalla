import { Balances } from 'ccxt';

import { Decision } from '../decision/entities/decision.entity';
import { OrderTypes } from '../upbit/upbit.enum';

export interface TradeRequest {
  symbol: string;
  market: string;
}

export interface TradeData {
  type: OrderTypes;
  symbol: string;
  market: string;
  amount: number;
  balances: Balances;
  decision: Decision;
}
