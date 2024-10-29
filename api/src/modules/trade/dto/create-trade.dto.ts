import { Inference } from '@/modules/inference/entities/inference.entity';

import { BalanceTypes, TradeTypes } from '../trade.type';

export class CreateTradeDto {
  type!: TradeTypes;
  symbol!: string;
  cost!: number;
  balance: BalanceTypes;
  inference: Inference;
}
