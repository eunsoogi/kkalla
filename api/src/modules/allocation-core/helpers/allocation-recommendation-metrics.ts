import { RecommendationItem } from '@/modules/allocation-core/allocation-core.types';
import { AllocationRecommendation } from '@/modules/allocation/entities/allocation-recommendation.entity';

interface RetryExecutor {
  retryWithFallback<T>(operation: () => Promise<T>): Promise<T>;
}

type ErrorLogger = (error: unknown) => void;

interface BuildLatestRecommendationMetricsMapOptions {
  recommendationItems: RecommendationItem[];
  errorService: RetryExecutor;
  onError: ErrorLogger;
}

export interface LatestRecommendationMetrics {
  intensity: number | null;
  modelTargetWeight: number | null;
}

async function fetchLatestRecommendationBySymbol(
  symbol: string,
  errorService: RetryExecutor,
  onError: ErrorLogger,
): Promise<AllocationRecommendation[]> {
  const operation = () =>
    AllocationRecommendation.find({
      where: { symbol },
      order: { createdAt: 'DESC' },
      take: 1,
    });

  try {
    return await errorService.retryWithFallback(operation);
  } catch (error) {
    onError(error);
    return [];
  }
}

export async function buildLatestAllocationRecommendationMetricsMap(
  options: BuildLatestRecommendationMetricsMapOptions,
): Promise<Map<string, LatestRecommendationMetrics>> {
  const symbols = Array.from(new Set(options.recommendationItems.map((item) => item.symbol)));
  const latestRecommendationMetricsBySymbol = await Promise.all(
    symbols.map(async (symbol) => {
      const recentRecommendations = await fetchLatestRecommendationBySymbol(
        symbol,
        options.errorService,
        options.onError,
      );
      const latestRecommendation = recentRecommendations[0];
      const latestIntensity =
        latestRecommendation?.intensity != null && Number.isFinite(latestRecommendation.intensity)
          ? Number(latestRecommendation.intensity)
          : null;
      const latestModelTargetWeight =
        latestRecommendation?.modelTargetWeight != null && Number.isFinite(latestRecommendation.modelTargetWeight)
          ? Number(latestRecommendation.modelTargetWeight)
          : null;

      return [
        symbol,
        {
          intensity: latestIntensity,
          modelTargetWeight: latestModelTargetWeight,
        },
      ] as const;
    }),
  );

  return new Map(latestRecommendationMetricsBySymbol);
}
