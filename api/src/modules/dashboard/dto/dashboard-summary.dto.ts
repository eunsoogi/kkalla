import { HoldingDto } from '@/modules/holding-ledger/dto/holding.dto';
import { Trade } from '@/modules/trade/entities/trade.entity';

import { Feargreed, FeargreedHistory } from '../../feargreed/feargreed.interface';
import { MarketSignalWithChangeDto } from '../../market-intelligence/dto/market-signal-with-change.dto';
import { News } from '../../news/news.interface';
import { ProfitDto } from '../../profit/dto/profit.dto';

export type DashboardSummarySectionKey =
  | 'marketReports'
  | 'news'
  | 'feargreed'
  | 'feargreedHistory'
  | 'holdings'
  | 'trades24h'
  | 'profit';

export interface DashboardSummaryDto {
  generatedAt: string;
  marketReports: MarketSignalWithChangeDto[];
  news: News[];
  feargreed: Feargreed | null;
  feargreedHistory: FeargreedHistory;
  holdings: HoldingDto[];
  trades24h: Trade[];
  profit: ProfitDto | null;
  errors?: Partial<Record<DashboardSummarySectionKey, string>>;
}
