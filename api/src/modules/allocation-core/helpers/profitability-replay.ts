import {
  type ProfitabilityMetricInput,
  type ProfitabilityMetrics,
  calculateProfitabilityMetrics,
} from './profitability-metrics';

export interface ProfitabilityReplayFixtureStep extends ProfitabilityMetricInput {
  recommendationId: string;
  symbol: string;
  horizonHours: number;
}

export interface ProfitabilityReplayFixture {
  version: number;
  generatedAt: string;
  windowDays: number;
  steps: ProfitabilityReplayFixtureStep[];
}

export interface ReplayPolicyComparisonOptions {
  baselineScale: number;
  candidateScale: number;
}

export interface ReplayPolicyComparison {
  baseline: ProfitabilityMetrics;
  candidate: ProfitabilityMetrics;
}

function assertFixtureStep(step: unknown): asserts step is ProfitabilityReplayFixtureStep {
  if (!step || typeof step !== 'object') {
    throw new Error('Invalid profitability replay fixture: step');
  }

  const record = step as Record<string, unknown>;
  const requiredKeys = [
    'recommendationId',
    'symbol',
    'horizonHours',
    'pnlAmount',
    'deployedCapital',
    'turnoverNotional',
    'equity',
  ] as const;

  for (const key of requiredKeys) {
    if (!(key in record)) {
      throw new Error(`Invalid profitability replay fixture: step.${key}`);
    }
  }
}

export function assertProfitabilityReplayFixture(fixture: unknown): asserts fixture is ProfitabilityReplayFixture {
  if (!fixture || typeof fixture !== 'object') {
    throw new Error('Invalid profitability replay fixture: root');
  }

  const record = fixture as Record<string, unknown>;
  if (!Array.isArray(record.steps)) {
    throw new Error('Invalid profitability replay fixture: steps');
  }

  record.steps.forEach(assertFixtureStep);
}

export function replayProfitabilityFixture(fixture: unknown): ProfitabilityMetrics {
  assertProfitabilityReplayFixture(fixture);
  return calculateProfitabilityMetrics(fixture.steps);
}

export function compareReplayPolicies(
  fixture: unknown,
  options: ReplayPolicyComparisonOptions,
): ReplayPolicyComparison {
  assertProfitabilityReplayFixture(fixture);

  const scaleSteps = (scale: number): ProfitabilityMetricInput[] =>
    fixture.steps.map((step) => ({
      pnlAmount: step.pnlAmount * scale,
      deployedCapital: step.deployedCapital * scale,
      turnoverNotional: step.turnoverNotional,
      equity: step.equity * scale,
    }));

  return {
    baseline: calculateProfitabilityMetrics(scaleSteps(options.baselineScale)),
    candidate: calculateProfitabilityMetrics(scaleSteps(options.candidateScale)),
  };
}
