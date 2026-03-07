import type { RecommendationItem } from '@/modules/allocation-core/allocation-core.types';
import { AllocationRecommendation } from '@/modules/allocation/entities/allocation-recommendation.entity';

export function mockLatestRecommendationQuery(...responses: any[][]) {
  const queryBuilder = {
    distinctOn: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  if (responses.length <= 1) {
    queryBuilder.getMany.mockResolvedValue(responses[0] ?? []);
  } else {
    for (const response of responses) {
      queryBuilder.getMany.mockResolvedValueOnce(response);
    }
  }

  const createQueryBuilderSpy = jest
    .spyOn(AllocationRecommendation, 'createQueryBuilder')
    .mockReturnValue(queryBuilder as any);

  return {
    createQueryBuilderSpy,
    queryBuilder,
  };
}

export async function expectTransportFailureRecommendationRun(options: {
  service: {
    allocationRecommendation(items: RecommendationItem[]): Promise<unknown>;
    openaiService: {
      createResponse: jest.Mock;
      getResponseOutput: jest.Mock;
    };
    featureService: {
      extractMarketFeatures: jest.Mock;
      formatMarketData: jest.Mock;
    };
    tradeOrchestrationService: {
      saveAllocationRecommendation: jest.Mock;
    };
  };
  items: RecommendationItem[];
}) {
  mockLatestRecommendationQuery([]);
  options.service.featureService.extractMarketFeatures.mockResolvedValue(null);
  options.service.featureService.formatMarketData.mockReturnValue('market-data');
  options.service.openaiService.createResponse.mockRejectedValue(new Error('openai timeout'));

  const saveSpy = jest.spyOn(options.service.tradeOrchestrationService, 'saveAllocationRecommendation');

  await expect(options.service.allocationRecommendation(options.items)).rejects.toThrow('openai timeout');

  expect(options.service.openaiService.createResponse).toHaveBeenCalledTimes(1);
  expect(saveSpy).not.toHaveBeenCalled();
}
