import { NewsTypes } from '@/modules/news/news.enum';

import {
  buildAllocationRecommendationPromptMessages,
  fetchCoinNewsWithFallback,
  fetchFearGreedIndexWithFallback,
} from './allocation-recommendation-context';

describe('balance-recommendation-context utils', () => {
  it('should fetch coin news with default query and retry wrapper', async () => {
    const news = [{ title: 'n', importance: 1 as any, timestamp: 1 }];
    const newsService = {
      getCompactNews: jest.fn().mockResolvedValue(news),
    };
    const errorService = {
      retryWithFallback: jest.fn(async (op: () => Promise<unknown>) => op()),
    };
    const onError = jest.fn();

    const result = await fetchCoinNewsWithFallback({
      newsService: newsService as any,
      errorService: errorService as any,
      onError,
    });

    expect(result).toEqual(news);
    expect(errorService.retryWithFallback).toHaveBeenCalledTimes(1);
    expect(newsService.getCompactNews).toHaveBeenCalledWith({
      type: NewsTypes.COIN,
      limit: 100,
      importanceLower: 1,
      skip: false,
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('should return [] when news fetch fails', async () => {
    const error = new Error('news failed');
    const newsService = { getCompactNews: jest.fn() };
    const errorService = {
      retryWithFallback: jest.fn().mockRejectedValue(error),
    };
    const onError = jest.fn();

    const result = await fetchCoinNewsWithFallback({
      newsService: newsService as any,
      errorService: errorService as any,
      onError,
    });

    expect(result).toEqual([]);
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should fetch feargreed and return null on failure', async () => {
    const feargreed = { value: 50, classification: 'Neutral', timestamp: 1700000000 };
    const feargreedService = {
      getCompactFeargreed: jest.fn().mockResolvedValue(feargreed),
    };
    const errorService = {
      retryWithFallback: jest.fn(async (op: () => Promise<unknown>) => op()),
    };
    const onError = jest.fn();

    const success = await fetchFearGreedIndexWithFallback({
      feargreedService: feargreedService as any,
      errorService: errorService as any,
      onError,
    });
    expect(success).toEqual(feargreed);

    const failureError = new Error('feargreed failed');
    errorService.retryWithFallback = jest.fn().mockRejectedValue(failureError);
    const failed = await fetchFearGreedIndexWithFallback({
      feargreedService: feargreedService as any,
      errorService: errorService as any,
      onError,
    });

    expect(failed).toBeNull();
    expect(onError).toHaveBeenCalledWith(failureError);
  });

  it('should build balance recommendation messages with context and features', async () => {
    const errorService = {
      retryWithFallback: jest.fn(async (op: () => Promise<unknown>) => op()),
    };
    const openaiService = {
      addMessage: jest.fn((messages: unknown[], role: string, content: unknown) => {
        messages.push({ role, content });
      }),
      addMessagePair: jest.fn((messages: unknown[], key: string, value: unknown) => {
        messages.push({ key, value });
      }),
    };
    const featureService = {
      MARKET_DATA_LEGEND: 'legend',
      extractMarketFeatures: jest.fn().mockResolvedValue({ volatility: 0.1 }),
      formatMarketData: jest.fn().mockReturnValue('market-data'),
    };
    const allocationAuditService = {
      buildAllocationValidationGuardrailText: jest.fn().mockResolvedValue('guardrail'),
    };

    const result = await buildAllocationRecommendationPromptMessages({
      symbol: 'BTC/KRW',
      prompt: 'prompt',
      openaiService: openaiService as any,
      featureService: featureService as any,
      newsService: {
        getCompactNews: jest.fn().mockResolvedValue([{ title: 'n' }]),
      } as any,
      feargreedService: {
        getCompactFeargreed: jest.fn().mockResolvedValue({ value: 50 }),
      } as any,
      errorService: errorService as any,
      allocationAuditService: allocationAuditService as any,
      onNewsError: jest.fn(),
      onFearGreedError: jest.fn(),
      onValidationGuardrailError: jest.fn(),
    });

    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.marketFeatures).toEqual({ volatility: 0.1 });
    expect(openaiService.addMessage).toHaveBeenCalled();
    expect(openaiService.addMessagePair).toHaveBeenCalledWith(
      expect.any(Array),
      'prompt.input.validation_allocation',
      'guardrail',
    );
  });

  it('should continue when validation guardrail loading fails', async () => {
    const onValidationGuardrailError = jest.fn();

    const result = await buildAllocationRecommendationPromptMessages({
      symbol: 'ETH/KRW',
      prompt: 'prompt',
      openaiService: {
        addMessage: jest.fn(),
        addMessagePair: jest.fn(),
      } as any,
      featureService: {
        MARKET_DATA_LEGEND: 'legend',
        extractMarketFeatures: jest.fn().mockResolvedValue(null),
        formatMarketData: jest.fn().mockReturnValue('market-data'),
      } as any,
      newsService: {
        getCompactNews: jest.fn().mockResolvedValue([]),
      } as any,
      feargreedService: {
        getCompactFeargreed: jest.fn().mockResolvedValue(null),
      } as any,
      errorService: {
        retryWithFallback: jest.fn(async (op: () => Promise<unknown>) => op()),
      } as any,
      allocationAuditService: {
        buildAllocationValidationGuardrailText: jest.fn().mockRejectedValue(new Error('guardrail failed')),
      } as any,
      onNewsError: jest.fn(),
      onFearGreedError: jest.fn(),
      onValidationGuardrailError,
    });

    expect(result.marketFeatures).toBeNull();
    expect(onValidationGuardrailError).toHaveBeenCalledTimes(1);
  });
});
