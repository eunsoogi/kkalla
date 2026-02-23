export const UPBIT_ALLOCATION_RECOMMENDATION_SHARED_CONFIG = {
  model: 'gpt-5.2',
  max_output_tokens: 16384,
  reasoning_effort: 'high' as const,
  service_tier: 'flex' as const,
  tools: [{ type: 'web_search' } as const],
  message: {
    news: 10,
    recent: 5,
    recentDateLimit: 7 * 24 * 60 * 60 * 1000, // 7일
  },
};

export const UPBIT_ALLOCATION_RECOMMENDATION_SHARED_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    symbol: {
      type: 'string',
    },
    action: {
      type: 'string',
      enum: ['buy', 'sell', 'hold', 'no_trade'],
    },
    intensity: {
      type: 'number',
      minimum: -1,
      maximum: 1,
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    expectedVolatilityPct: {
      type: 'number',
      minimum: 0,
    },
    riskFlags: {
      type: 'array',
      items: {
        type: 'string',
      },
      minItems: 0,
      maxItems: 10,
    },
    reason: {
      type: 'string',
    },
  },
  required: ['symbol', 'action', 'intensity', 'confidence', 'expectedVolatilityPct', 'riskFlags', 'reason'],
  additionalProperties: false,
};
