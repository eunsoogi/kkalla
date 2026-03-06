import {
  ALLOCATION_RECOMMENDATION_SHARED_CONFIG,
  ALLOCATION_RECOMMENDATION_SHARED_RESPONSE_SCHEMA,
} from '@/modules/allocation-core/allocation-recommendation.prompt.shared';
import { loadPromptMarkdown } from '@/utils/prompt-loader';

export const ALLOCATION_RECOMMENDATION_PROMPT = loadPromptMarkdown(__dirname, 'allocation-recommendation.prompt.md');

export const ALLOCATION_RECOMMENDATION_CONFIG = ALLOCATION_RECOMMENDATION_SHARED_CONFIG;
export const ALLOCATION_RECOMMENDATION_RESPONSE_SCHEMA = ALLOCATION_RECOMMENDATION_SHARED_RESPONSE_SCHEMA;
