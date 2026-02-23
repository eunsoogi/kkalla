import { AllocationAuditBadge } from '@/app/(dashboard)/_shared/inference/_types/inference.types';
import { News } from '@/app/(dashboard)/_shared/news/news.types';
import { ProfitData } from '@/app/(dashboard)/_shared/profit/_types/profit.types';
import { Trade } from '@/app/(dashboard)/_shared/trades/trade.types';

import { Feargreed, FeargreedHistory } from '../feargreed/_types/feargreed.types';

/** 최신 마켓 리포트 (추천 시점 대비 변동률 포함) */
export interface MarketReportWithChange {
  id: string;
  seq: number;
  symbol: string;
  weight: number;
  reason: string;
  confidence: number;
  batchId: string;
  createdAt: string;
  updatedAt: string;
  recommendationPrice?: number;
  currentPrice?: number;
  priceChangePct?: number;
  validation24h?: AllocationAuditBadge;
  validation72h?: AllocationAuditBadge;
}

/** 보유 종목 (History 기반, 당일 변동량 포함) */
export interface HoldingWithDailyChange {
  symbol: string;
  category?: string;
  currentPrice?: number;
  dailyChangePct?: number;
  dailyChangeAbs?: number;
}

export type DashboardSummarySectionKey =
  | 'marketReports'
  | 'news'
  | 'feargreed'
  | 'feargreedHistory'
  | 'holdings'
  | 'trades24h'
  | 'profit';

export interface DashboardSummaryResponse {
  generatedAt: string;
  marketReports: MarketReportWithChange[];
  news: News[];
  feargreed: Feargreed | null;
  feargreedHistory: FeargreedHistory;
  holdings: HoldingWithDailyChange[];
  trades24h: Trade[];
  profit: ProfitData | null;
  errors?: Partial<Record<DashboardSummarySectionKey, string>>;
}
