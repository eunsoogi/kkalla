import { loadPromptMarkdown } from '@/utils/prompt-loader';

export const ALLOCATION_AUDIT_EVALUATOR_PROMPT = loadPromptMarkdown(__dirname, 'allocation-audit.prompt.md');

export const ALLOCATION_AUDIT_EVALUATOR_CONFIG = {
  model: 'gpt-5.4',
  max_output_tokens: 8192,
  reasoning_effort: 'low' as const,
  service_tier: 'auto' as const,
};

export const ALLOCATION_AUDIT_EVALUATOR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: {
      type: 'string',
      enum: ['good', 'mixed', 'bad', 'invalid'],
    },
    score: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    calibration: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    explanation: {
      type: 'string',
    },
    nextGuardrail: {
      type: 'string',
    },
  },
  required: ['verdict', 'score', 'calibration', 'explanation', 'nextGuardrail'],
  additionalProperties: false,
};
