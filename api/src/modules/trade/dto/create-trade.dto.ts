import { Inference } from '../../inference/entities/inference.entity';
import { BalanceTypes } from '../entities/trade.entity';
import { TradeTypes } from '../trade.interface';

export class CreateTradeDto {
  type!: TradeTypes;
  symbol!: string;
  cost!: number;
  balance: BalanceTypes;
  inference: Inference;
}
