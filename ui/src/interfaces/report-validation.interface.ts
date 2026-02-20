import { PaginatedItem } from './item.interface';

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
  | 'gptScore'
  | 'symbol'
  | 'status'
  | 'gptVerdict';

export interface ReportValidationRun {
  id: string;
  seq: number;
  reportType: ReportType;
  sourceBatchId: string;
  horizonHours: number;
  status: ReportValidationStatus;
  itemCount: number;
  completedCount: number;
  deterministicScoreAvg: number | null;
  gptScoreAvg: number | null;
  overallScore: number | null;
  summary: string | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportValidationItem {
  id: string;
  seq: number;
  runId: string;
  reportType: ReportType;
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
  gptVerdict: ReportValidationVerdict | null;
  gptScore: number | null;
  gptCalibration: number | null;
  gptExplanation: string | null;
  nextGuardrail: string | null;
  status: ReportValidationStatus;
  evaluatedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportValidationRunSummary {
  totalRuns: number;
  pendingOrRunning: number;
  completed: number;
  avgScore: number | null;
}

export interface ReportValidationItemSummary {
  itemCount: number;
  invalidCount: number;
  avgItemScore: number | null;
  avgReturn: number | null;
  verdictGood: number;
  verdictMixed: number;
  verdictBad: number;
}

export type ReportValidationRunPage = PaginatedItem<ReportValidationRun> & {
  summary?: ReportValidationRunSummary;
};
export type ReportValidationItemPage = PaginatedItem<ReportValidationItem> & {
  summary?: ReportValidationItemSummary;
};
