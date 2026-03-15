export type ProfitabilityRuntimeComparisonMode = 'single-path-production';

export interface ProfitabilityTurnoverPolicy {
  newEntryMaxTurnoverFraction: number;
  existingAdjustmentMaxTurnoverFraction: number;
  defensiveExitMaxTurnoverFraction: number;
}

export interface ProfitabilityBreakoutEntryPolicy {
  minimumDecisionConfidence: number;
  maximumConcurrentEntries: number;
  maximumEntriesPerCategory: number;
}

export interface ProfitabilityAuditPolicy {
  targetHitRate: number;
  targetHitRateLift: number;
  replayWindowDays: number;
  preferredHorizons: number[];
}

export interface ProfitabilityCalibrationPolicy {
  lowCostActiveExecutionNotionalMultiplier: number;
  mediumCostActiveExecutionNotionalMultiplier: number;
  elevatedCostActiveExecutionNotionalMultiplier: number;
}

export interface ProfitabilityPolicyInvariantSummary {
  requiresReplayImprovement: true;
  allowsNewIssueSpecificFlags: false;
  allowsDegradedRegimeBreakoutEntries: false;
  runtimeComparisonMode: ProfitabilityRuntimeComparisonMode;
}

export interface ProfitabilityPolicy {
  grossExposureTarget: number;
  replacementEdgeDeltaMin: number;
  turnover: ProfitabilityTurnoverPolicy;
  breakoutEntry: ProfitabilityBreakoutEntryPolicy;
  audit: ProfitabilityAuditPolicy;
  calibration: ProfitabilityCalibrationPolicy;
  invariants: ProfitabilityPolicyInvariantSummary;
}
