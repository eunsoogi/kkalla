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

  it('should measure drawdown from starting equity when the first sample is a loss', () => {
    const steps: ProfitabilityMetricInput[] = [
      { pnlAmount: -100, deployedCapital: 400, turnoverNotional: 100, equity: 900 },
      { pnlAmount: 50, deployedCapital: 200, turnoverNotional: 80, equity: 950 },
      { pnlAmount: 70, deployedCapital: 100, turnoverNotional: 60, equity: 1020 },
    ];

    expect(calculateProfitabilityMetrics(steps)).toEqual({
      feeAdjustedNetExpectancy: 6.666666666666667,
      deployedCapitalRatio: 0.23333333333333334,
      pnlPerTurnover: 0.08333333333333333,
      maxDrawdownPct: 0.1,
      recoveryStepCount: 2,
      sampleCount: 3,
    });
  });
});
