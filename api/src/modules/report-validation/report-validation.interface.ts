import { PaginatedItem } from '../item/item.interface';

export type ReportType = 'market' | 'portfolio';
export type ReportValidationStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ReportValidationVerdict = 'good' | 'mixed' | 'bad' | 'invalid';

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
  gptScoreAvg: number | null;
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
  gptVerdict: ReportValidationVerdict | null;
  gptScore: number | null;
  gptCalibration: number | null;
  gptExplanation: string | null;
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

export type ReportValidationRunPage = PaginatedItem<ReportValidationRunListItem>;
export type ReportValidationRunItemPage = PaginatedItem<ReportValidationRunItemListItem>;
