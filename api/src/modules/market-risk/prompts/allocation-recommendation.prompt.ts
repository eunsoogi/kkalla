import {
  UPBIT_ALLOCATION_RECOMMENDATION_SHARED_CONFIG,
  UPBIT_ALLOCATION_RECOMMENDATION_SHARED_RESPONSE_SCHEMA,
} from '@/modules/allocation-core/allocation-recommendation.prompt.shared';
import { loadPromptMarkdown } from '@/utils/prompt-loader';

export const UPBIT_ALLOCATION_RECOMMENDATION_PROMPT = loadPromptMarkdown(
  __dirname,
  'allocation-recommendation.prompt.md',
);

export const UPBIT_ALLOCATION_RECOMMENDATION_CONFIG = UPBIT_ALLOCATION_RECOMMENDATION_SHARED_CONFIG;
export const UPBIT_ALLOCATION_RECOMMENDATION_RESPONSE_SCHEMA = UPBIT_ALLOCATION_RECOMMENDATION_SHARED_RESPONSE_SCHEMA;
