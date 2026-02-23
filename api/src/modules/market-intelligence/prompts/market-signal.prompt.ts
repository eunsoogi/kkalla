import { loadPromptMarkdown } from '@/utils/prompt-loader';

export const UPBIT_MARKET_SIGNAL_PROMPT = loadPromptMarkdown(__dirname, 'market-signal.prompt.md');

// GPT-5.2 모델 설정 - 최대 10개 종목 추천용
export const UPBIT_MARKET_SIGNAL_CONFIG = {
  model: 'gpt-5.2',
  max_output_tokens: 16384,
  reasoning_effort: 'high' as const,
  service_tier: 'auto' as const,
  tools: [{ type: 'web_search' } as const],
};

export const UPBIT_MARKET_SIGNAL_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          weight: { type: 'number', minimum: 0, maximum: 1 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          cashWeight: { type: 'number', minimum: 0, maximum: 1 },
          regime: { type: 'string', enum: ['risk_on', 'neutral', 'risk_off'] },
          riskFlags: {
            type: 'array',
            items: { type: 'string' },
            minItems: 0,
            maxItems: 10,
          },
          reason: { type: 'string' },
        },
        required: ['symbol', 'weight', 'confidence', 'cashWeight', 'regime', 'riskFlags', 'reason'],
        additionalProperties: false,
      },
      minItems: 0,
      maxItems: 10,
    },
  },
  required: ['recommendations'],
  additionalProperties: false,
};
