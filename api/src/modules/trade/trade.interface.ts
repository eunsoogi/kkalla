import { Balances } from 'ccxt';

import { Decision } from '../decision/entities/decision.entity';
import { Inference } from '../inference/entities/inference.entity';
import { OrderTypes } from '../upbit/upbit.enum';

export interface InferenceWithDecision {
  infer: Inference;
  decision: Decision;
}

export interface Ticker {
  symbol: string;
  market: string;
}

export interface TradeData {
  ticker: string;
  type: OrderTypes;
  amount: number;
  balances: Balances;
  decision: Decision;
}
