export interface ProfitabilityMetricInput {
  pnlAmount: number;
  deployedCapital: number;
  turnoverNotional: number;
  equity: number;
}

export interface ProfitabilityMetrics {
  feeAdjustedNetExpectancy: number | null;
  deployedCapitalRatio: number | null;
  pnlPerTurnover: number | null;
  maxDrawdownPct: number | null;
  recoveryStepCount: number;
  sampleCount: number;
}

function toSafeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function calculateProfitabilityMetrics(steps: ProfitabilityMetricInput[]): ProfitabilityMetrics {
  if (steps.length === 0) {
    return {
      feeAdjustedNetExpectancy: null,
      deployedCapitalRatio: null,
      pnlPerTurnover: null,
      maxDrawdownPct: null,
      recoveryStepCount: 0,
      sampleCount: 0,
    };
  }

  const totalPnl = steps.reduce((sum, step) => sum + toSafeNumber(step.pnlAmount), 0);
  const totalTurnover = steps.reduce((sum, step) => sum + Math.max(0, toSafeNumber(step.turnoverNotional)), 0);
  const averageDeployedCapital =
    steps.reduce((sum, step) => sum + Math.max(0, toSafeNumber(step.deployedCapital)), 0) / steps.length;
  const initialCapital = Math.max(0, toSafeNumber(steps[0].equity) - toSafeNumber(steps[0].pnlAmount));

  let peakEquity = initialCapital > Number.EPSILON ? initialCapital : toSafeNumber(steps[0].equity);
  let maxDrawdownPct = 0;
  let drawdownStartIndex: number | null = null;
  let recoveryStepCount = 0;

  steps.forEach((step, index) => {
    const equity = toSafeNumber(step.equity);

    if (equity >= peakEquity) {
      peakEquity = equity;
      if (drawdownStartIndex != null) {
        recoveryStepCount = Math.max(recoveryStepCount, index - drawdownStartIndex);
        drawdownStartIndex = null;
      }
      return;
    }

    if (peakEquity <= Number.EPSILON) {
      return;
    }

    const drawdownPct = (peakEquity - equity) / peakEquity;
    if (drawdownPct > maxDrawdownPct) {
      maxDrawdownPct = drawdownPct;
    }
    if (drawdownPct > 0 && drawdownStartIndex == null) {
      drawdownStartIndex = index;
    }
  });

  return {
    feeAdjustedNetExpectancy: totalPnl / steps.length,
    deployedCapitalRatio: initialCapital > Number.EPSILON ? averageDeployedCapital / initialCapital : null,
    pnlPerTurnover: totalTurnover > Number.EPSILON ? totalPnl / totalTurnover : null,
    maxDrawdownPct,
    recoveryStepCount,
    sampleCount: steps.length,
  };
}
