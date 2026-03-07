import type { EasyInputMessage } from 'openai/resources/responses/responses';

import type { Feargreed, MarketRegimeSnapshot } from '@/modules/market-regime/market-regime.types';
import { NewsTypes } from '@/modules/news/news.enum';
import type { CompactNews } from '@/modules/news/news.types';
import type { MarketFeatures } from '@/modules/upbit/upbit.types';

export interface RetryFallbackExecutor {
  retryWithFallback<T>(operation: () => Promise<T>): Promise<T>;
}

export interface NewsReader {
  getCompactNews(params: {
    type: NewsTypes;
    limit: number;
    importanceLower: number;
    skip: boolean;
  }): Promise<CompactNews[]>;
}

export interface MarketRegimeReader {
  getSnapshot(): Promise<MarketRegimeSnapshot>;
}

export interface ErrorLogger {
  (error: unknown): void;
}

export interface FetchCoinNewsWithFallbackOptions {
  newsService: NewsReader;
  errorService: RetryFallbackExecutor;
  onError: ErrorLogger;
}

export interface FetchMarketRegimeWithFallbackOptions {
  marketRegimeService: MarketRegimeReader;
  errorService: RetryFallbackExecutor;
  onError: ErrorLogger;
}

export interface AllocationRecommendationPromptBuilder {
  addMessage(messages: EasyInputMessage[], role: 'system' | 'user', content: string): void;
  addPromptPair(messages: EasyInputMessage[], prompt: string, value: unknown): void;
}

export interface MarketFeatureContextFormatter {
  MARKET_DATA_LEGEND: string;
  extractMarketFeatures(symbol: string): Promise<MarketFeatures | null>;
  formatMarketData(features: Array<MarketFeatures | null>): string;
}

export interface ValidationGuardrailProvider {
  buildAllocationValidationGuardrailText(symbol: string): Promise<string | null>;
}

export interface BuildAllocationRecommendationPromptMessagesOptions {
  symbols: string[];
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

export interface BuildAllocationRecommendationPromptMessagesResult {
  messages: EasyInputMessage[];
  marketFeaturesBySymbol: Map<string, MarketFeatures | null>;
  marketRegime: MarketRegimeSnapshot | null;
  feargreed: Feargreed | null;
}
