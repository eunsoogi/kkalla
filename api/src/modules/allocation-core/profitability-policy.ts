import { SHARED_REBALANCE_POLICY } from './allocation-core.constants';
import { ProfitabilityPolicy, ProfitabilityPolicyInvariantSummary } from './profitability-policy.types';

export const DEFAULT_PROFITABILITY_POLICY: ProfitabilityPolicy = {
  grossExposureTarget: SHARED_REBALANCE_POLICY.defaultGrossExposureTarget,
  replacementEdgeDeltaMin: SHARED_REBALANCE_POLICY.replacementEdgeDeltaMin,
  turnover: {
    newEntryMaxTurnoverFraction: SHARED_REBALANCE_POLICY.newEntryMaxTurnoverFraction,
    existingAdjustmentMaxTurnoverFraction: SHARED_REBALANCE_POLICY.existingAdjustmentMaxTurnoverFraction,
    defensiveExitMaxTurnoverFraction: SHARED_REBALANCE_POLICY.defensiveExitMaxTurnoverFraction,
  },
  breakoutEntry: {
    minimumDecisionConfidence: SHARED_REBALANCE_POLICY.breakoutEntryMinConfidence,
    maximumConcurrentEntries: SHARED_REBALANCE_POLICY.breakoutEntryMaxConcurrentEntries,
    maximumEntriesPerCategory: SHARED_REBALANCE_POLICY.breakoutEntryMaxEntriesPerCategory,
  },
  audit: {
    targetHitRate: SHARED_REBALANCE_POLICY.profitabilityAuditTargetHitRate,
    targetHitRateLift: SHARED_REBALANCE_POLICY.profitabilityAuditTargetHitRateLift,
    replayWindowDays: SHARED_REBALANCE_POLICY.profitabilityReplayWindowDays,
    preferredHorizons: [...SHARED_REBALANCE_POLICY.profitabilityAuditPreferredHorizons],
  },
  calibration: {
    lowCostActiveExecutionNotionalMultiplier:
      SHARED_REBALANCE_POLICY.calibrationLowCostActiveExecutionNotionalMultiplier,
    mediumCostActiveExecutionNotionalMultiplier:
      SHARED_REBALANCE_POLICY.calibrationMediumCostActiveExecutionNotionalMultiplier,
    elevatedCostActiveExecutionNotionalMultiplier:
      SHARED_REBALANCE_POLICY.calibrationElevatedCostActiveExecutionNotionalMultiplier,
  },
  invariants: {
    requiresReplayImprovement: true,
    allowsNewIssueSpecificFlags: false,
    allowsDegradedRegimeBreakoutEntries: false,
    runtimeComparisonMode: 'single-path-production',
  },
};

export function getDefaultProfitabilityPolicy(): ProfitabilityPolicy {
  return DEFAULT_PROFITABILITY_POLICY;
}

export function getProfitabilityPolicyInvariantSummary(): ProfitabilityPolicyInvariantSummary {
  return DEFAULT_PROFITABILITY_POLICY.invariants;
}
