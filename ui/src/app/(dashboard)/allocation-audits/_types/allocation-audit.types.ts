import { PaginatedItem } from '@/shared/types/pagination.types';

export type AllocationAuditReportType = 'market' | 'allocation';
export type AllocationAuditStatus = 'pending' | 'running' | 'completed' | 'failed';
export type AllocationAuditVerdict = 'good' | 'mixed' | 'bad' | 'invalid';
export type AllocationAuditSortOrder = 'asc' | 'desc';
export type AllocationAuditRunSortBy = 'createdAt' | 'completedAt' | 'overallScore' | 'status' | 'seq';
export type AllocationAuditItemSortBy =
  | 'createdAt'
  | 'evaluatedAt'
  | 'returnPct'
  | 'deterministicScore'
  | 'aiScore'
  | 'symbol'
  | 'status'
  | 'aiVerdict';

export interface AllocationAuditRun {
  id: string;
  seq: number;
  reportType: AllocationAuditReportType;
  sourceBatchId: string;
  horizonHours: number;
  status: AllocationAuditStatus;
  itemCount: number;
  completedCount: number;
  deterministicScoreAvg: number | null;
  aiScoreAvg: number | null;
  overallScore: number | null;
  summary: string | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AllocationAuditItem {
  id: string;
  seq: number;
  runId: string;
  reportType: AllocationAuditReportType;
  sourceRecommendationId: string;
  sourceBatchId: string;
  symbol: string;
  horizonHours: number;
  dueAt: string;
  recommendationCreatedAt: string;
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
  aiVerdict: AllocationAuditVerdict | null;
  aiScore: number | null;
  aiCalibration: number | null;
  aiExplanation: string | null;
  nextGuardrail: string | null;
  status: AllocationAuditStatus;
  evaluatedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AllocationAuditRunSummary {
  totalRuns: number;
  pendingOrRunning: number;
  completed: number;
  avgScore: number | null;
  recommendedMarketMinConfidenceForAllocation: number | null;
}

export interface AllocationAuditItemSummary {
  itemCount: number;
  invalidCount: number;
  avgItemScore: number | null;
  avgReturn: number | null;
  verdictGood: number;
  verdictMixed: number;
  verdictBad: number;
}

export type AllocationAuditRunPage = PaginatedItem<AllocationAuditRun> & {
  summary?: AllocationAuditRunSummary;
};
export type AllocationAuditItemPage = PaginatedItem<AllocationAuditItem> & {
  summary?: AllocationAuditItemSummary;
};
