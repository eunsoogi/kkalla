import { HoldingDto } from '@/modules/holding-ledger/dto/holding.dto';
import { Trade } from '@/modules/trade/entities/trade.entity';

import { MarketSignalWithChangeDto } from '../../market-intelligence/dto/market-signal-with-change.dto';
import { MarketRegimeSnapshot } from '../../market-regime/market-regime.types';
import { News } from '../../news/news.types';
import { ProfitDto } from '../../profit/dto/profit.dto';

export type DashboardSummarySectionKey =
  | 'marketReports'
  | 'marketRegime'
  | 'news'
  | 'holdings'
  | 'trades24h'
  | 'profit';

export interface DashboardSummaryDto {
  generatedAt: string;
  marketReports: MarketSignalWithChangeDto[];
  marketRegime: MarketRegimeSnapshot | null;
  news: News[];
  holdings: HoldingDto[];
  trades24h: Trade[];
  profit: ProfitDto | null;
  errors?: Partial<Record<DashboardSummarySectionKey, string>>;
}
