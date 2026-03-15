import { SHARED_REBALANCE_POLICY } from './allocation-core.constants';
import {
  DEFAULT_PROFITABILITY_POLICY,
  getDefaultProfitabilityPolicy,
  getProfitabilityPolicyInvariantSummary,
} from './profitability-policy';

describe('profitability policy contract', () => {
  it('should expose a single default production policy for issue 874', () => {
    const policy = getDefaultProfitabilityPolicy();

    expect(policy).toEqual(DEFAULT_PROFITABILITY_POLICY);
    expect(policy.grossExposureTarget).toBeGreaterThan(0);
    expect(policy.grossExposureTarget).toBeLessThanOrEqual(1);
    expect(policy.turnover.newEntryMaxTurnoverFraction).toBeGreaterThan(
      SHARED_REBALANCE_POLICY.symbolMaxTurnoverFraction,
    );
    expect(policy.turnover.existingAdjustmentMaxTurnoverFraction).toBeLessThanOrEqual(
      policy.turnover.newEntryMaxTurnoverFraction,
    );
    expect(policy.invariants.runtimeComparisonMode).toBe('single-path-production');
  });

  it('should publish direct-production invariants for issue 874', () => {
    expect(getProfitabilityPolicyInvariantSummary()).toEqual({
      requiresReplayImprovement: true,
      allowsNewIssueSpecificFlags: false,
      allowsDegradedRegimeBreakoutEntries: false,
      runtimeComparisonMode: 'single-path-production',
    });
  });
});
