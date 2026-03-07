import {
  ALLOCATION_RECOMMENDATION_MESSAGE_CONFIG,
  createAllocationRecommendationRequestConfig,
} from '@/modules/allocation-core/allocation-recommendation.prompt.shared';
import { loadPromptMarkdown } from '@/utils/prompt-loader';

export const ALLOCATION_RECOMMENDATION_PROMPT = loadPromptMarkdown(__dirname, 'allocation-recommendation.prompt.md');

export const MARKET_RISK_ALLOCATION_RECOMMENDATION_CONFIG = {
  model: 'gpt-5.4',
  max_output_tokens: 8192,
  reasoning_effort: 'low' as const,
  service_tier: 'flex' as const,
  tools: [{ type: 'web_search' } as const],
  message: ALLOCATION_RECOMMENDATION_MESSAGE_CONFIG,
};

export function createMarketRiskAllocationRecommendationRequestConfig(maxItems: number) {
  return createAllocationRecommendationRequestConfig(maxItems, MARKET_RISK_ALLOCATION_RECOMMENDATION_CONFIG);
}
