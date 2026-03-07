import {
  ALLOCATION_RECOMMENDATION_MESSAGE_CONFIG,
  type AllocationRecommendationRequestConfigBase,
  createAllocationRecommendationRequestConfig,
} from '@/modules/allocation-core/allocation-recommendation.prompt.shared';
import type { AllocationMode } from '@/modules/allocation/allocation.types';
import { loadPromptMarkdown } from '@/utils/prompt-loader';

export const ALLOCATION_RECOMMENDATION_PROMPT = loadPromptMarkdown(__dirname, 'allocation-recommendation.prompt.md');

export const ALLOCATION_NEW_RECOMMENDATION_CONFIG: AllocationRecommendationRequestConfigBase = {
  model: 'gpt-5.4',
  max_output_tokens: 8192,
  reasoning_effort: 'medium' as const,
  service_tier: 'flex' as const,
  tools: [{ type: 'web_search' } as const],
  message: ALLOCATION_RECOMMENDATION_MESSAGE_CONFIG,
};

export const ALLOCATION_EXISTING_RECOMMENDATION_CONFIG: AllocationRecommendationRequestConfigBase = {
  model: 'gpt-5.4',
  max_output_tokens: 8192,
  reasoning_effort: 'low' as const,
  service_tier: 'flex' as const,
  tools: [{ type: 'web_search' } as const],
  message: ALLOCATION_RECOMMENDATION_MESSAGE_CONFIG,
};

export function createAllocationRecommendationRequestConfigByMode(allocationMode: AllocationMode, maxItems: number) {
  const config =
    allocationMode === 'existing' ? ALLOCATION_EXISTING_RECOMMENDATION_CONFIG : ALLOCATION_NEW_RECOMMENDATION_CONFIG;

  return createAllocationRecommendationRequestConfig(maxItems, config);
}
