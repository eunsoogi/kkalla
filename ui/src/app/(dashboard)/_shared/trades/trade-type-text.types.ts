import type { TradeTypes } from '@/enums/trade.enum';

export interface TradeTypeTextProps {
  type: TradeTypes;
  label: string;
  className?: string;
}
