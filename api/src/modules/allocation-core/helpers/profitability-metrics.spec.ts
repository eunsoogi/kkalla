import { type ProfitabilityMetricInput, calculateProfitabilityMetrics } from './profitability-metrics';

describe('calculateProfitabilityMetrics', () => {
  it('should calculate expectancy utilization turnover and drawdown from a fixed replay sequence', () => {
    const steps: ProfitabilityMetricInput[] = [
      { pnlAmount: 100, deployedCapital: 500, turnoverNotional: 200, equity: 1100 },
      { pnlAmount: -50, deployedCapital: 300, turnoverNotional: 100, equity: 1050 },
      { pnlAmount: 0, deployedCapital: 0, turnoverNotional: 50, equity: 1050 },
      { pnlAmount: 150, deployedCapital: 700, turnoverNotional: 300, equity: 1200 },
    ];

    expect(calculateProfitabilityMetrics(steps)).toEqual({
      feeAdjustedNetExpectancy: 50,
      deployedCapitalRatio: 0.375,
      pnlPerTurnover: 0.3076923076923077,
      maxDrawdownPct: 0.045454545454545456,
      recoveryStepCount: 2,
      sampleCount: 4,
    });
  });

  it('should return null-safe metrics for an empty replay sequence', () => {
    expect(calculateProfitabilityMetrics([])).toEqual({
      feeAdjustedNetExpectancy: null,
      deployedCapitalRatio: null,
      pnlPerTurnover: null,
      maxDrawdownPct: null,
      recoveryStepCount: 0,
      sampleCount: 0,
    });
  });
});
