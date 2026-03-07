import type { ResponseCreateConfig } from '@/modules/openai/openai.types';

export const ALLOCATION_RECOMMENDATION_MESSAGE_CONFIG = {
  news: 10,
  recent: 5,
  recentDateLimit: 7 * 24 * 60 * 60 * 1000, // 7일
};

export type AllocationRecommendationRequestConfigBase = Omit<ResponseCreateConfig, 'text'>;

export const ALLOCATION_RECOMMENDATION_RESPONSE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    symbol: {
      type: 'string',
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
      maximum: 1,
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
  required: ['symbol', 'intensity', 'confidence', 'expectedVolatilityPct', 'riskFlags', 'reason'],
  additionalProperties: false,
} as const;

export function createAllocationRecommendationResponseSchema(maxItems: number) {
  const normalizedMaxItems = Number.isFinite(maxItems) ? Math.max(1, Math.trunc(maxItems)) : 1;

  return {
    type: 'object',
    properties: {
      recommendations: {
        type: 'array',
        items: ALLOCATION_RECOMMENDATION_RESPONSE_ITEM_SCHEMA,
        minItems: normalizedMaxItems,
        maxItems: normalizedMaxItems,
      },
    },
    required: ['recommendations'],
    additionalProperties: false,
  };
}

export function createAllocationRecommendationRequestConfig(
  maxItems: number,
  config: AllocationRecommendationRequestConfigBase,
): ResponseCreateConfig {
  return {
    ...config,
    text: {
      format: {
        type: 'json_schema',
        name: 'allocation_recommendation',
        strict: true,
        schema: createAllocationRecommendationResponseSchema(maxItems) as Record<string, unknown>,
      },
    },
  };
}
