import { TradeTypes } from '@/enums/trade.enum';
import type { ReportTone } from '@/utils/status-tone.types';

export const TRADE_STYLES: Record<TradeTypes, { tone: ReportTone }> = {
  [TradeTypes.BUY]: {
    tone: 'positive',
  },
  [TradeTypes.SELL]: {
    tone: 'negative',
  },
};
