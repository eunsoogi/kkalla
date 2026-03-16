import fixture from '../__fixtures__/issue-874-profitability-60d.fixture.json';
import { compareReplayPolicies, replayProfitabilityFixture } from './profitability-replay';

describe('profitability replay harness', () => {
  it('should replay the checked-in 60 day fixture into stable baseline metrics', () => {
    expect(replayProfitabilityFixture(fixture)).toEqual({
      feeAdjustedNetExpectancy: 53.333333333333336,
      deployedCapitalRatio: 0.4666666666666667,
      pnlPerTurnover: 0.2909090909090909,
      maxDrawdownPct: 0.03571428571428571,
      recoveryStepCount: 1,
      sampleCount: 3,
    });
  });

  it('should reject malformed replay fixtures with a deterministic error', () => {
    expect(() => replayProfitabilityFixture({ version: 1, generatedAt: '2026-03-15T00:00:00.000Z' })).toThrow(
      'Invalid profitability replay fixture: steps',
    );
  });

  it('should keep replay-only policy comparison outside runtime code', () => {
    const comparison = compareReplayPolicies(fixture, {
      baselineScale: 1,
      candidateScale: 1.05,
    });

    expect(comparison.baseline.sampleCount).toBe(3);
    expect(comparison.candidate.feeAdjustedNetExpectancy).toBeGreaterThan(
      comparison.baseline.feeAdjustedNetExpectancy!,
    );
  });
});
