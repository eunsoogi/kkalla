import { RecommendationItem } from '@/modules/allocation-core/allocation-core.types';
import { AllocationRecommendation } from '@/modules/allocation/entities/allocation-recommendation.entity';
import { Category } from '@/modules/category/category.enum';

import { buildLatestAllocationRecommendationMetricsMap } from './allocation-recommendation-metrics';

describe('balance-recommendation-metrics utils', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should build latest metrics map from latest recommendations per unique symbol', async () => {
    const findSpy = jest.spyOn(AllocationRecommendation, 'find');
    findSpy
      .mockResolvedValueOnce([
        {
          intensity: 0.2,
          modelTargetWeight: 0.3,
        } as AllocationRecommendation,
      ])
      .mockResolvedValueOnce([
        {
          intensity: 0.6,
          modelTargetWeight: 0.7,
        } as AllocationRecommendation,
      ]);

    const retryWithFallback = jest.fn(async <T>(operation: () => Promise<T>) => operation());
    const onError = jest.fn();
    const items: RecommendationItem[] = [
      { symbol: 'BTC/KRW', category: Category.COIN_MAJOR, hasStock: true },
      { symbol: 'ETH/KRW', category: Category.COIN_MAJOR, hasStock: true },
      { symbol: 'BTC/KRW', category: Category.COIN_MAJOR, hasStock: false },
    ];

    const result = await buildLatestAllocationRecommendationMetricsMap({
      recommendationItems: items,
      errorService: { retryWithFallback },
      onError,
    });

    expect(retryWithFallback).toHaveBeenCalledTimes(2);
    expect(findSpy).toHaveBeenCalledTimes(2);
    expect(result.get('BTC/KRW')).toEqual({ intensity: 0.2, modelTargetWeight: 0.3 });
    expect(result.get('ETH/KRW')).toEqual({ intensity: 0.6, modelTargetWeight: 0.7 });
    expect(onError).not.toHaveBeenCalled();
  });

  it('should keep null metrics and call onError when recommendation fetch fails', async () => {
    const error = new Error('failed');
    const retryWithFallback = jest.fn().mockRejectedValue(error);
    const onError = jest.fn();
    const items: RecommendationItem[] = [{ symbol: 'XRP/KRW', category: Category.COIN_MINOR, hasStock: false }];

    const result = await buildLatestAllocationRecommendationMetricsMap({
      recommendationItems: items,
      errorService: { retryWithFallback },
      onError,
    });

    expect(onError).toHaveBeenCalledWith(error);
    expect(result.get('XRP/KRW')).toEqual({ intensity: null, modelTargetWeight: null });
  });
});
