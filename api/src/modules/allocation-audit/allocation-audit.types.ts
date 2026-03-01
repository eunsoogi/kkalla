import { PaginatedItem } from '../item/item.types';

export type ReportType = 'market' | 'allocation';
export type AllocationAuditStatus = 'pending' | 'running' | 'completed' | 'failed';
export type AllocationAuditVerdict = 'good' | 'mixed' | 'bad' | 'invalid';
export type AllocationAuditSortOrder = 'asc' | 'desc';
export type AllocationAuditRunSortBy = 'createdAt' | 'completedAt' | 'overallScore' | 'status';
export type AllocationAuditItemSortBy =
  | 'createdAt'
  | 'evaluatedAt'
  | 'returnPct'
  | 'deterministicScore'
  | 'aiScore'
  | 'symbol'
  | 'status'
  | 'aiVerdict';

export interface DeterministicEvaluation {
  evaluatedPrice: number | null;
  recommendationPrice: number | null;
  returnPct: number | null;
  directionHit: boolean | null;
  deterministicScore: number | null;
  realizedTradePnl: number | null;
  realizedTradeAmount: number | null;
  tradeRoiPct: number | null;
  invalidReason?: string;
}

export interface ConfidenceCalibrationSample {
  confidence: number;
  directionHit: boolean;
  horizonHours: number;
}

export interface AllocationAuditRunListItem {
  id: string;
  reportType: ReportType;
  sourceBatchId: string;
  horizonHours: number;
  status: AllocationAuditStatus;
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

export interface AllocationAuditRunItemListItem {
  id: string;
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
  recommendationBtcDominance: number | null;
  recommendationAltcoinIndex: number | null;
  recommendationMarketRegimeAsOf: Date | null;
  recommendationMarketRegimeSource: 'live' | 'cache_fallback' | null;
  recommendationMarketRegimeIsStale: boolean | null;
  recommendationFeargreedIndex: number | null;
  recommendationFeargreedClassification: string | null;
  recommendationFeargreedTimestamp: Date | null;
  evaluatedPrice: number | null;
  returnPct: number | null;
  directionHit: boolean | null;
  realizedTradePnl: number | null;
  realizedTradeAmount: number | null;
  tradeRoiPct: number | null;
  deterministicScore: number | null;
  aiVerdict: AllocationAuditVerdict | null;
  aiScore: number | null;
  aiCalibration: number | null;
  aiExplanation: string | null;
  nextGuardrail: string | null;
  status: AllocationAuditStatus;
  evaluatedAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AllocationAuditBadge {
  status: AllocationAuditStatus;
  overallScore?: number | null;
  verdict?: AllocationAuditVerdict | null;
  evaluatedAt?: Date | null;
}

export interface MarketValidationBadges {
  validation24h?: AllocationAuditBadge;
  validation72h?: AllocationAuditBadge;
}

export interface AllocationValidationBadges {
  validation24h?: AllocationAuditBadge;
  validation72h?: AllocationAuditBadge;
}

export interface AllocationAuditRunSummary {
  totalRuns: number;
  pendingOrRunning: number;
  completed: number;
  avgScore: number | null;
  recommendedMarketMinConfidenceForAllocation: number | null;
}

export interface AllocationAuditRunItemSummary {
  itemCount: number;
  invalidCount: number;
  avgItemScore: number | null;
  avgReturn: number | null;
  verdictGood: number;
  verdictMixed: number;
  verdictBad: number;
}

export type AllocationAuditRunPage = PaginatedItem<AllocationAuditRunListItem> & {
  summary?: AllocationAuditRunSummary;
};
export type AllocationAuditRunItemPage = PaginatedItem<AllocationAuditRunItemListItem> & {
  summary?: AllocationAuditRunItemSummary;
};
