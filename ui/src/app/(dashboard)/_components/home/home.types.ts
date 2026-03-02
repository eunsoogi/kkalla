import type { HoldingWithDailyChange, MarketReportWithChange } from './_types/dashboard-summary.types';
import type { MarketRegimeFeargreed } from './_types/market-regime.types';
import type { News } from '@/app/(dashboard)/_shared/news/news.types';
import type { Trade } from '@/app/(dashboard)/_shared/trades/trade.types';

export interface TradeList24hProps {
  items?: Trade[];
  isLoading?: boolean;
}

export interface HoldingRowProps {
  item: HoldingWithDailyChange;
}

export interface HoldingsListProps {
  items?: HoldingWithDailyChange[];
  isLoading?: boolean;
}

export type MarketRegimeGaugeType = 'btcDominance' | 'altcoinSeasonIndex';

export interface FeargreedGaugeProps {
  item?: MarketRegimeFeargreed | null;
  gaugeId?: string;
  pointUnitLabel: string;
}

export interface FeargreedWidgetProps {
  title: string;
  item?: MarketRegimeFeargreed | null;
  asOf?: string | Date | null;
  isLoading?: boolean;
  gaugeId?: string;
}

export interface MarketRegimeWidgetProps {
  title: string;
  stateLabel: string;
  gaugeId: string;
  type: MarketRegimeGaugeType;
  value?: number | null;
  asOf?: string | Date | null;
  isLoading?: boolean;
}

export interface NewsWidgetProps {
  items?: News[];
  isLoading?: boolean;
}

export interface MarketReportRowProps {
  item: MarketReportWithChange;
  onRowClick: (id: string) => void;
}

export interface MarketReportListProps {
  items?: MarketReportWithChange[];
  isLoading?: boolean;
}
