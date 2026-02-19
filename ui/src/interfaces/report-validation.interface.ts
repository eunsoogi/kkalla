export type ReportType = 'market' | 'portfolio';
export type ReportValidationStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ReportValidationVerdict = 'good' | 'mixed' | 'bad' | 'invalid';

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
