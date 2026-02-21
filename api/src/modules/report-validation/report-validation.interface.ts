import { PaginatedItem } from '../item/item.interface';

export type ReportType = 'market' | 'portfolio';
export type ReportValidationStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ReportValidationVerdict = 'good' | 'mixed' | 'bad' | 'invalid';
export type ReportValidationSortOrder = 'asc' | 'desc';
export type ReportValidationRunSortBy = 'createdAt' | 'completedAt' | 'overallScore' | 'status' | 'seq';
export type ReportValidationItemSortBy =
  | 'createdAt'
  | 'evaluatedAt'
  | 'returnPct'
  | 'deterministicScore'
  | 'aiScore'
  | 'symbol'
  | 'status'
  | 'aiVerdict';

export interface ReportValidationRunListItem {
  id: string;
  seq: number;
  reportType: ReportType;
  sourceBatchId: string;
  horizonHours: number;
  status: ReportValidationStatus;
  itemCount: number;
  completedCount: number;
  deterministicScoreAvg: number | null;
  aiScoreAvg: number | null;
  overallScore: number | null;
  summary: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportValidationRunItemListItem {
  id: string;
  seq: number;
  runId: string;
  reportType: ReportType;
  sourceRecommendationId: string;
  sourceBatchId: string;
  symbol: string;
  horizonHours: number;
  dueAt: Date;
  recommendationCreatedAt: Date;
  recommendationReason: string | null;
  recommendationConfidence: number | null;
  recommendationWeight: number | null;
  recommendationIntensity: number | null;
  recommendationAction: string | null;
  recommendationPrice: number | null;
  evaluatedPrice: number | null;
  returnPct: number | null;
  directionHit: boolean | null;
  realizedTradePnl: number | null;
  realizedTradeAmount: number | null;
  tradeRoiPct: number | null;
  deterministicScore: number | null;
  aiVerdict: ReportValidationVerdict | null;
  aiScore: number | null;
  aiCalibration: number | null;
  aiExplanation: string | null;
  nextGuardrail: string | null;
  status: ReportValidationStatus;
  evaluatedAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportValidationBadge {
  status: ReportValidationStatus;
  overallScore?: number | null;
  verdict?: ReportValidationVerdict | null;
  evaluatedAt?: Date | null;
}

export interface MarketValidationBadges {
  validation24h?: ReportValidationBadge;
  validation72h?: ReportValidationBadge;
}

export interface PortfolioValidationBadges {
  validation24h?: ReportValidationBadge;
  validation72h?: ReportValidationBadge;
}

export interface ReportValidationRunSummary {
  totalRuns: number;
  pendingOrRunning: number;
  completed: number;
  avgScore: number | null;
  recommendedMarketMinConfidenceForPortfolio: number | null;
}

export interface ReportValidationRunItemSummary {
  itemCount: number;
  invalidCount: number;
  avgItemScore: number | null;
  avgReturn: number | null;
  verdictGood: number;
  verdictMixed: number;
  verdictBad: number;
}

export type ReportValidationRunPage = PaginatedItem<ReportValidationRunListItem> & {
  summary?: ReportValidationRunSummary;
};
export type ReportValidationRunItemPage = PaginatedItem<ReportValidationRunItemListItem> & {
  summary?: ReportValidationRunItemSummary;
};
