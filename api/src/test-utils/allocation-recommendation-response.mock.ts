const DEFAULT_WRAPPED_RECOMMENDATION = {
  symbol: 'BTC/KRW',
  intensity: 0,
  confidence: 0.7,
  expectedVolatilityPct: 0.02,
  riskFlags: [],
  reason: '기본 근거',
};

export function buildWrappedRecommendationResponse(partial: Record<string, unknown> = {}) {
  return {
    recommendations: [
      {
        ...DEFAULT_WRAPPED_RECOMMENDATION,
        ...partial,
      },
    ],
  };
}

export function buildWrappedRecommendationsResponse(items: Array<Record<string, unknown>>) {
  return {
    recommendations: items.map((item) => ({
      ...DEFAULT_WRAPPED_RECOMMENDATION,
      ...item,
    })),
  };
}
