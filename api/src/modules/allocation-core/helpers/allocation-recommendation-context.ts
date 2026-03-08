import type { EasyInputMessage } from 'openai/resources/responses/responses';

import type { MarketRegimeSnapshot } from '@/modules/market-regime/market-regime.types';
import { NewsTypes } from '@/modules/news/news.enum';
import type { CompactNews } from '@/modules/news/news.types';
import type { MarketFeatures } from '@/modules/upbit/upbit.types';
import {
  PROMPT_INPUT_FEARGREED,
  PROMPT_INPUT_MARKET_REGIME,
  PROMPT_INPUT_NEWS,
  PROMPT_INPUT_TARGET_SYMBOLS,
  PROMPT_INPUT_VALIDATION_ALLOCATION,
} from '@/prompts/input';

import type {
  BuildAllocationRecommendationPromptMessagesOptions,
  BuildAllocationRecommendationPromptMessagesResult,
  FetchCoinNewsWithFallbackOptions,
  FetchMarketRegimeWithFallbackOptions,
} from './allocation-recommendation-context.types';

/**
 * Retrieves coin news with fallback for the allocation recommendation flow.
 * @param options - Configuration for the allocation recommendation flow.
 * @returns Processed collection for downstream workflow steps.
 */
export async function fetchCoinNewsWithFallback(options: FetchCoinNewsWithFallbackOptions): Promise<CompactNews[]> {
  const operation = () =>
    options.newsService.getCompactNews({
      type: NewsTypes.COIN,
      limit: 100,
      importanceLower: 1,
      skip: false,
    });

  try {
    return await options.errorService.retryWithFallback(operation);
  } catch (error) {
    // Prompt context is best-effort; continue without news on transient failures.
    options.onError(error);
    return [];
  }
}

/**
 * Retrieves market regime snapshot with fallback for the allocation recommendation flow.
 * @param options - Configuration for the allocation recommendation flow.
 * @returns Asynchronous result produced by the allocation recommendation flow.
 */
export async function fetchMarketRegimeWithFallback(
  options: FetchMarketRegimeWithFallbackOptions,
): Promise<MarketRegimeSnapshot | null> {
  const operation = () => options.marketRegimeService.getSnapshot();

  try {
    return await options.errorService.retryWithFallback(operation);
  } catch (error) {
    // Keep recommendation flow alive even when market regime source is unavailable, but surface
    // the degraded execution state explicitly so downstream persistence and policy logic can
    // distinguish it from neutral market conditions.
    options.onError(error);
    return {
      btcDominance: 55,
      btcDominanceClassification: 'transition',
      altcoinIndex: 50,
      altcoinIndexClassification: 'neutral',
      feargreed: null,
      asOf: new Date(),
      source: 'unavailable_risk_off',
      isStale: true,
      staleAgeMinutes: 0,
    };
  }
}

/**
 * Builds allocation recommendation prompt messages used in the allocation recommendation flow.
 * @param options - Configuration for the allocation recommendation flow.
 * @returns Processed collection for downstream workflow steps.
 */
export async function buildAllocationRecommendationPromptMessages(
  options: BuildAllocationRecommendationPromptMessagesOptions,
): Promise<BuildAllocationRecommendationPromptMessagesResult> {
  const messages: EasyInputMessage[] = [];
  const uniqueSymbols = Array.from(new Set(options.symbols.filter((symbol) => symbol.trim().length > 0)));
  const marketFeaturesBySymbol = new Map<string, MarketFeatures | null>();

  options.openaiService.addMessage(messages, 'system', options.prompt);
  if (uniqueSymbols.length > 0) {
    options.openaiService.addPromptPair(messages, PROMPT_INPUT_TARGET_SYMBOLS, uniqueSymbols);
  }

  const news = await fetchCoinNewsWithFallback({
    newsService: options.newsService,
    errorService: options.errorService,
    onError: options.onNewsError,
  });
  if (news.length > 0) {
    options.openaiService.addPromptPair(messages, PROMPT_INPUT_NEWS, news);
  }

  const marketRegime = await fetchMarketRegimeWithFallback({
    marketRegimeService: options.marketRegimeService,
    errorService: options.errorService,
    onError: options.onMarketRegimeError,
  });
  if (marketRegime) {
    options.openaiService.addPromptPair(messages, PROMPT_INPUT_MARKET_REGIME, marketRegime);
  }

  const feargreed = marketRegime?.feargreed ?? null;
  if (feargreed) {
    options.openaiService.addPromptPair(messages, PROMPT_INPUT_FEARGREED, feargreed);
  }

  const validationSummaries = (
    await Promise.all(
      uniqueSymbols.map(async (symbol) => {
        try {
          const summary = await options.allocationAuditService.buildAllocationValidationGuardrailText(symbol);
          if (!summary) {
            return null;
          }

          return {
            symbol,
            summary,
          };
        } catch (error) {
          options.onValidationGuardrailError(error, symbol);
          return null;
        }
      }),
    )
  ).filter((item): item is { symbol: string; summary: string } => item != null);

  if (validationSummaries.length > 0) {
    options.openaiService.addPromptPair(messages, PROMPT_INPUT_VALIDATION_ALLOCATION, validationSummaries);
  }

  const marketFeaturesList = await Promise.all(
    uniqueSymbols.map(async (symbol) => {
      const marketFeatures = await options.featureService.extractMarketFeatures(symbol);
      marketFeaturesBySymbol.set(symbol, marketFeatures);
      return marketFeatures;
    }),
  );
  const marketData = options.featureService.formatMarketData(marketFeaturesList);
  options.openaiService.addMessage(messages, 'user', `${options.featureService.MARKET_DATA_LEGEND}\n\n${marketData}`);

  return { messages, marketFeaturesBySymbol, marketRegime, feargreed };
}
