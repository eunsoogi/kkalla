export type ExceptionChipType = 'validationFailed' | 'validationRunning' | 'regimeStale' | 'risk' | 'partialFill';

export interface ValidationStatusSnapshot {
  status?: string | null;
  verdict?: string | null;
}

export interface ExceptionRuleInput {
  validation24h?: ValidationStatusSnapshot | null;
  validation72h?: ValidationStatusSnapshot | null;
  regimeStale?: boolean | null;
  riskFlags?: string[] | null;
  filledRatio?: number | null;
}
