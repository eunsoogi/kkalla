import { Inference } from '@/modules/inferences/entities/inference.entity';

import { BalanceTypes, TradeTypes } from '../trade.type';

export class CreateTradeDto {
  type!: TradeTypes;
  symbol!: string;
  amount!: number;
  balance: BalanceTypes;
  inference: Inference;
}