import { AllocationRecommendationData } from '@/modules/allocation-core/allocation-core.types';
import { Category } from '@/modules/category/category.enum';

import {
  calculateAllocationModelSignals,
  calculateFeatureScore,
  calculateRegimeAdjustedTargetWeight,
  clamp,
  clamp01,
  estimateBuyNotionalFromRequest,
  filterExcludedHeldRecommendations,
  filterExcludedRecommendationsByCategory,
  filterIncludedRecommendations,
  filterIncludedRecommendationsByCategory,
  isIncludedRecommendation,
  isKrwSymbol,
  isNoTradeRecommendation,
  isOrderableSymbol,
  isSellAmountSufficient,
  normalizeAllocationRecommendationAction,
  normalizeAllocationRecommendationResponsePayload,
  passesCostGate,
  resolveAllocationRecommendationAction,
  resolveAvailableKrwBalance,
  scaleBuyRequestsToAvailableKrw,
  sortAllocationRecommendationsByPriority,
  toPercentString,
} from './allocation-recommendation';

/**
 * Builds inference used in the allocation recommendation flow.
 * @param partial - Input value for partial.
 * @returns Result produced by the allocation recommendation flow.
 */
function createInference(partial: Partial<AllocationRecommendationData> = {}): AllocationRecommendationData {
  return {
    id: 'id',
    batchId: 'batch',
    symbol: 'BTC/KRW',
    category: Category.COIN_MAJOR,
    intensity: 0.2,
    hasStock: false,
    ...partial,
  };
}

describe('balance-recommendation utils', () => {
  it('should clamp values correctly', () => {
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(Number.NaN)).toBe(0);
  });

  it('should normalize action values', () => {
    expect(normalizeAllocationRecommendationAction('buy')).toBe('buy');
    expect(normalizeAllocationRecommendationAction('invalid')).toBe('hold');
  });

  it('should normalize recommendation response payload with clamped values', () => {
    const normalized = normalizeAllocationRecommendationResponsePayload(
      {
        symbol: 'BTC/KRW',
        action: 'invalid-action',
        intensity: 1.4,
        confidence: -0.3,
        expectedVolatilityPct: -1,
        riskFlags: ['r1', 2, 'r2'],
        reason: '  keep trend  ',
      },
      { expectedSymbol: 'BTC/KRW' },
    );

    expect(normalized).toEqual({
      action: 'hold',
      intensity: 1,
      confidence: 0,
      expectedVolatilityPct: 0,
      riskFlags: ['r1', 'r2'],
      reason: 'keep trend',
    });
  });

  it('should keep payload and invoke mismatch callback when drop option is disabled', () => {
    const onSymbolMismatch = jest.fn();
    const normalized = normalizeAllocationRecommendationResponsePayload(
      {
        symbol: 'ETH/KRW',
        action: 'buy',
        intensity: 0.3,
      },
      {
        expectedSymbol: 'BTC/KRW',
        onSymbolMismatch,
      },
    );

    expect(normalized).not.toBeNull();
    expect(onSymbolMismatch).toHaveBeenCalledWith({
      outputSymbol: 'ETH/KRW',
      expectedSymbol: 'BTC/KRW',
    });
  });

  it('should drop payload on symbol mismatch when drop option is enabled', () => {
    const onSymbolMismatch = jest.fn();
    const normalized = normalizeAllocationRecommendationResponsePayload(
      {
        symbol: 'ETH/KRW',
        action: 'buy',
        intensity: 0.3,
      },
      {
        expectedSymbol: 'BTC/KRW',
        dropOnSymbolMismatch: true,
        onSymbolMismatch,
      },
    );

    expect(normalized).toBeNull();
    expect(onSymbolMismatch).toHaveBeenCalledWith({
      outputSymbol: 'ETH/KRW',
      expectedSymbol: 'BTC/KRW',
    });
  });

  it('should resolve action from model target, intensity, and sell score', () => {
    expect(resolveAllocationRecommendationAction(0.3, 0.2, 0.5, 0, 0.6)).toBe('buy');
    expect(resolveAllocationRecommendationAction(-0.1, 0.2, 0, 0, 0.6)).toBe('sell');
    expect(resolveAllocationRecommendationAction(0.2, 0.7, 0, 0, 0.6)).toBe('sell');
    expect(resolveAllocationRecommendationAction(0.2, 0.2, 0, 0, 0.6)).toBe('hold');
  });

  it('should classify no-trade/included recommendation', () => {
    expect(isNoTradeRecommendation(createInference({ action: 'hold' }), 0.35)).toBe(true);
    expect(isNoTradeRecommendation(createInference({ action: 'buy', decisionConfidence: 0.2 }), 0.35)).toBe(true);
    expect(isIncludedRecommendation(createInference({ action: 'buy', modelTargetWeight: 0.4 }), 0, 0.35)).toBe(true);
    expect(
      isIncludedRecommendation(createInference({ action: 'buy', modelTargetWeight: 0, intensity: 0.1 }), 0.2, 0.35),
    ).toBe(false);
  });

  it('should evaluate cost gate and estimate buy notional', () => {
    expect(passesCostGate(0.05, 0.0005, 0.001, 2)).toBe(true);
    expect(passesCostGate(0.001, 0.0005, 0.001, 2)).toBe(false);
    expect(estimateBuyNotionalFromRequest({ symbol: 'BTC/KRW', diff: 0.2, marketPrice: 1000 })).toBe(200);
  });

  it('should calculate model signals from shared weights and feature config', () => {
    const signals = calculateAllocationModelSignals({
      intensity: 0.6,
      marketFeatures: null,
      featureScoreConfig: {
        featureConfidenceWeight: 0.3,
        featureMomentumWeight: 0.25,
        featureLiquidityWeight: 0.2,
        featureVolatilityWeight: 0.15,
        featureStabilityWeight: 0.1,
        volatilityReference: 0.12,
      },
      aiSignalWeight: 0.7,
      featureSignalWeight: 0.3,
      minimumTradeIntensity: 0,
      sellScoreThreshold: 0.6,
    });

    expect(signals.buyScore).toBeCloseTo(0.42, 10);
    expect(signals.sellScore).toBeCloseTo(0.3, 10);
    expect(signals.modelTargetWeight).toBeCloseTo(0.42, 10);
    expect(signals.action).toBe('buy');
  });

  it('should calculate regime adjusted target weight safely', () => {
    expect(calculateRegimeAdjustedTargetWeight(0.5, 0.8)).toBeCloseTo(0.4, 10);
    expect(calculateRegimeAdjustedTargetWeight(0, 0.8)).toBe(0);
    expect(calculateRegimeAdjustedTargetWeight(0.5, Number.NaN)).toBeCloseTo(0.5, 10);
  });

  it('should proportionally scale buy requests when estimated notional exceeds available KRW', () => {
    const buyRequests = [
      { symbol: 'BTC/KRW', diff: 0.2, marketPrice: 1_000_000 },
      { symbol: 'ETH/KRW', diff: 0.1, marketPrice: 1_000_000 },
    ];

    const scaled = scaleBuyRequestsToAvailableKrw(buyRequests, 40_000, {
      tradableMarketValueMap: new Map([
        ['BTC/KRW', 300_000],
        ['ETH/KRW', 200_000],
      ]),
      fallbackMarketPrice: 1_000_000,
      minimumTradePrice: 5_000,
    });

    expect(scaled).toHaveLength(2);
    expect(scaled[0].diff).toBeCloseTo(0.1, 10);
    expect(scaled[1].diff).toBeCloseTo(0.05, 10);
  });

  it('should drop scaled buy requests that fall below minimum order amount', () => {
    const buyRequests = [
      { symbol: 'XRP/KRW', diff: 0.06, marketPrice: 1_000_000 },
      { symbol: 'BTC/KRW', diff: 0.1, marketPrice: 1_000_000 },
    ];

    const scaled = scaleBuyRequestsToAvailableKrw(buyRequests, 53_000, {
      tradableMarketValueMap: new Map([
        ['XRP/KRW', 100_000],
        ['BTC/KRW', 1_000_000],
      ]),
      fallbackMarketPrice: 1_000_000,
      minimumTradePrice: 5_000,
    });

    expect(scaled).toHaveLength(1);
    expect(scaled[0].symbol).toBe('BTC/KRW');
    expect(scaled[0].diff).toBeCloseTo(0.05, 10);
  });

  it('should sort recommendations by stock-hold and score priority', () => {
    const sorted = sortAllocationRecommendationsByPriority([
      createInference({ symbol: 'A/KRW', hasStock: false, buyScore: 0.4, intensity: 0.3 }),
      createInference({ symbol: 'B/KRW', hasStock: true, buyScore: 0.1, intensity: 0.1 }),
      createInference({ symbol: 'C/KRW', hasStock: false, buyScore: 0.7, intensity: 0.8 }),
    ]);

    expect(sorted.map((item) => item.symbol)).toEqual(['B/KRW', 'C/KRW', 'A/KRW']);
  });

  it('should validate orderable symbol and sell amount threshold', () => {
    expect(isKrwSymbol('BTC/KRW')).toBe(true);
    expect(isKrwSymbol('AAPL/USD')).toBe(false);
    expect(isOrderableSymbol('BTC/KRW')).toBe(true);
    expect(isOrderableSymbol('BTC/USDT')).toBe(false);
    expect(isOrderableSymbol('BTC/KRW', new Set(['ETH/KRW']))).toBe(false);

    const tradableMarketValueMap = new Map<string, number>([['BTC/KRW', 20_000]]);
    expect(isSellAmountSufficient('BTC/KRW', -0.1, 5_000, tradableMarketValueMap)).toBe(false);
    expect(isSellAmountSufficient('BTC/KRW', -0.5, 5_000, tradableMarketValueMap)).toBe(true);
  });

  it('should resolve KRW balance from info then fallback', () => {
    const fromInfo = resolveAvailableKrwBalance({
      info: [{ currency: 'KRW', unit_currency: 'KRW', balance: '1200' }],
    } as any);
    const fromFallback = resolveAvailableKrwBalance({
      info: [],
      KRW: { free: 300 },
    } as any);
    expect(fromInfo).toBe(1200);
    expect(fromFallback).toBe(300);
  });

  it('should return 0 feature score when features are missing', () => {
    expect(
      calculateFeatureScore(null, {
        featureConfidenceWeight: 0.3,
        featureMomentumWeight: 0.25,
        featureLiquidityWeight: 0.2,
        featureVolatilityWeight: 0.15,
        featureStabilityWeight: 0.1,
        volatilityReference: 0.12,
      }),
    ).toBe(0);
  });

  it('should format percent text safely', () => {
    expect(toPercentString(0.123)).toBe('12%');
    expect(toPercentString(null)).toBe('-');
  });

  it('should filter included/excluded recommendations with shared helpers', () => {
    const inferences = [
      createInference({
        symbol: 'AAA/KRW',
        category: Category.COIN_MAJOR,
        modelTargetWeight: 0.5,
        action: 'buy',
        hasStock: true,
      }),
      createInference({
        symbol: 'BBB/KRW',
        category: Category.COIN_MINOR,
        modelTargetWeight: 0,
        action: 'sell',
        hasStock: true,
      }),
      createInference({
        symbol: 'CCC/KRW',
        category: Category.COIN_MINOR,
        modelTargetWeight: 0.4,
        action: 'buy',
        hasStock: false,
      }),
    ];

    const included = filterIncludedRecommendations(inferences, {
      minimumTradeIntensity: 0,
      minAllocationConfidence: 0.35,
    });
    const excluded = filterExcludedHeldRecommendations(inferences, {
      minimumTradeIntensity: 0,
      minAllocationConfidence: 0.35,
    });

    expect(included.map((item) => item.symbol)).toEqual(['AAA/KRW', 'CCC/KRW']);
    expect(excluded.map((item) => item.symbol)).toEqual(['BBB/KRW']);
  });

  it('should filter recommendations by category limits', () => {
    const inferences = [
      createInference({
        symbol: 'MAJOR1/KRW',
        category: Category.COIN_MAJOR,
        modelTargetWeight: 0.5,
        buyScore: 0.9,
        action: 'buy',
      }),
      createInference({
        symbol: 'MAJOR2/KRW',
        category: Category.COIN_MAJOR,
        modelTargetWeight: 0.4,
        buyScore: 0.8,
        action: 'buy',
      }),
      createInference({
        symbol: 'MINOR1/KRW',
        category: Category.COIN_MINOR,
        modelTargetWeight: 0.3,
        buyScore: 0.7,
        action: 'buy',
      }),
      createInference({
        symbol: 'MINOR2/KRW',
        category: Category.COIN_MINOR,
        modelTargetWeight: 0.2,
        buyScore: 0.6,
        action: 'buy',
      }),
      createInference({
        symbol: 'HOLD1/KRW',
        category: Category.COIN_MINOR,
        modelTargetWeight: 0,
        action: 'hold',
      }),
    ];
    const config = {
      minimumTradeIntensity: 0,
      minAllocationConfidence: 0.35,
      categoryItemCountConfig: {
        coinMajorItemCount: 1,
        coinMinorItemCount: 1,
        nasdaqItemCount: 0,
      },
    };

    const included = filterIncludedRecommendationsByCategory(inferences, config);
    const excluded = filterExcludedRecommendationsByCategory(inferences, config);

    expect(included.map((item) => item.symbol)).toEqual(['MAJOR1/KRW', 'MINOR1/KRW']);
    expect(excluded.map((item) => item.symbol)).toEqual(['MAJOR2/KRW', 'MINOR2/KRW']);
  });
});
