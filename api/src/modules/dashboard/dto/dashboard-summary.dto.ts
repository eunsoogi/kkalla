import { HoldingDto } from '@/modules/history/dto/holding.dto';
import { Trade } from '@/modules/trade/entities/trade.entity';

import { Feargreed, FeargreedHistory } from '../../feargreed/feargreed.interface';
import { MarketRecommendationWithChangeDto } from '../../market-research/dto/market-recommendation-with-change.dto';
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
  marketReports: MarketRecommendationWithChangeDto[];
  news: News[];
  feargreed: Feargreed | null;
  feargreedHistory: FeargreedHistory;
  holdings: HoldingDto[];
  trades24h: Trade[];
  profit: ProfitDto | null;
  errors?: Partial<Record<DashboardSummarySectionKey, string>>;
}
