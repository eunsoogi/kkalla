import type { EasyInputMessage } from 'openai/resources/responses/responses';

import { Feargreed, MarketRegimeSnapshot } from '@/modules/market-regime/market-regime.types';
import { NewsTypes } from '@/modules/news/news.enum';
import { CompactNews } from '@/modules/news/news.types';
import { MarketFeatures } from '@/modules/upbit/upbit.types';

interface RetryFallbackExecutor {
  retryWithFallback<T>(operation: () => Promise<T>): Promise<T>;
}

interface NewsReader {
  getCompactNews(params: {
    type: NewsTypes;
    limit: number;
    importanceLower: number;
    skip: boolean;
  }): Promise<CompactNews[]>;
}

interface MarketRegimeReader {
  getSnapshot(): Promise<MarketRegimeSnapshot>;
}

interface ErrorLogger {
  (error: unknown): void;
}

interface FetchCoinNewsWithFallbackOptions {
  newsService: NewsReader;
  errorService: RetryFallbackExecutor;
  onError: ErrorLogger;
}

interface FetchMarketRegimeWithFallbackOptions {
  marketRegimeService: MarketRegimeReader;
  errorService: RetryFallbackExecutor;
  onError: ErrorLogger;
}

interface AllocationRecommendationPromptBuilder {
  addMessage(messages: EasyInputMessage[], role: 'system' | 'user', content: string): void;
  addMessagePair(messages: EasyInputMessage[], key: string, value: unknown): void;
}

interface MarketFeatureContextFormatter {
  MARKET_DATA_LEGEND: string;
  extractMarketFeatures(symbol: string): Promise<MarketFeatures | null>;
  formatMarketData(features: Array<MarketFeatures | null>): string;
}

interface ValidationGuardrailProvider {
  buildAllocationValidationGuardrailText(symbol: string): Promise<string | null>;
}

interface BuildAllocationRecommendationPromptMessagesOptions {
  symbol: string;
  prompt: string;
  openaiService: AllocationRecommendationPromptBuilder;
  featureService: MarketFeatureContextFormatter;
  newsService: NewsReader;
  marketRegimeService: MarketRegimeReader;
  errorService: RetryFallbackExecutor;
  allocationAuditService: ValidationGuardrailProvider;
  onNewsError: ErrorLogger;
  onMarketRegimeError: ErrorLogger;
  onValidationGuardrailError: (error: unknown, symbol: string) => void;
}

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
    // Keep recommendation flow alive even when market regime source is unavailable.
    options.onError(error);
    return null;
  }
}

/**
 * Builds allocation recommendation prompt messages used in the allocation recommendation flow.
 * @param options - Configuration for the allocation recommendation flow.
 * @returns Processed collection for downstream workflow steps.
 */
export async function buildAllocationRecommendationPromptMessages(
  options: BuildAllocationRecommendationPromptMessagesOptions,
): Promise<{
  messages: EasyInputMessage[];
  marketFeatures: MarketFeatures | null;
  marketRegime: MarketRegimeSnapshot | null;
  feargreed: Feargreed | null;
}> {
  const messages: EasyInputMessage[] = [];

  options.openaiService.addMessage(messages, 'system', options.prompt);

  const news = await fetchCoinNewsWithFallback({
    newsService: options.newsService,
    errorService: options.errorService,
    onError: options.onNewsError,
  });
  if (news.length > 0) {
    options.openaiService.addMessagePair(messages, 'prompt.input.news', news);
  }

  const marketRegime = await fetchMarketRegimeWithFallback({
    marketRegimeService: options.marketRegimeService,
    errorService: options.errorService,
    onError: options.onMarketRegimeError,
  });
  if (marketRegime) {
    options.openaiService.addMessagePair(messages, 'prompt.input.market_regime', marketRegime);
  }

  const feargreed = marketRegime?.feargreed ?? null;
  if (feargreed) {
    options.openaiService.addMessagePair(messages, 'prompt.input.feargreed', feargreed);
  }

  try {
    const validationSummary = await options.allocationAuditService.buildAllocationValidationGuardrailText(
      options.symbol,
    );
    // Validation summary is optional guardrail text, not a hard dependency.
    if (validationSummary) {
      options.openaiService.addMessagePair(messages, 'prompt.input.validation_allocation', validationSummary);
    }
  } catch (error) {
    options.onValidationGuardrailError(error, options.symbol);
  }

  const marketFeatures = await options.featureService.extractMarketFeatures(options.symbol);
  const marketData = options.featureService.formatMarketData([marketFeatures]);
  // Always provide structured market features so model input shape stays stable.
  options.openaiService.addMessage(messages, 'user', `${options.featureService.MARKET_DATA_LEGEND}\n\n${marketData}`);

  return { messages, marketFeatures, marketRegime, feargreed };
}
