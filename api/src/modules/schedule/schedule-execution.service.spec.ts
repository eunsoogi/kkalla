import { MarketResearchService } from '../market-research/market-research.service';
import { RebalanceService } from '../rebalance/rebalance.service';
import { RedlockService } from '../redlock/redlock.service';
import { ScheduleExecutionService } from './schedule-execution.service';

describe('ScheduleExecutionService', () => {
  let service: ScheduleExecutionService;
  let marketResearchService: {
    executeMarketRecommendationTask: jest.Mock;
  };
  let rebalanceService: {
    executeBalanceRecommendationExistingTask: jest.Mock;
    executeBalanceRecommendationNewTask: jest.Mock;
  };
  let redlockService: {
    startWithLock: jest.Mock;
  };
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    marketResearchService = {
      executeMarketRecommendationTask: jest.fn().mockResolvedValue(undefined),
    };
    rebalanceService = {
      executeBalanceRecommendationExistingTask: jest.fn().mockResolvedValue(undefined),
      executeBalanceRecommendationNewTask: jest.fn().mockResolvedValue(undefined),
    };
    redlockService = {
      startWithLock: jest.fn().mockResolvedValue(true),
    };

    process.env.NODE_ENV = 'test';
    service = new ScheduleExecutionService(
      marketResearchService as unknown as MarketResearchService,
      rebalanceService as unknown as RebalanceService,
      redlockService as unknown as RedlockService,
    );
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('should return skipped_development without acquiring lock in development mode', async () => {
    process.env.NODE_ENV = 'development';

    const result = await service.executeMarketRecommendation();

    expect(redlockService.startWithLock).not.toHaveBeenCalled();
    expect(result.task).toBe('marketRecommendation');
    expect(result.status).toBe('skipped_development');
  });

  it('should return configured execution plans with cron and run times', () => {
    const plans = service.getExecutionPlans();

    expect(plans).toEqual([
      {
        task: 'marketRecommendation',
        cronExpression: '0 0 0 * * *',
        timezone: 'Asia/Seoul',
        runAt: ['00:00'],
      },
      {
        task: 'balanceRecommendationExisting',
        cronExpression: '0 35 0,4,8,12,16,20 * * *',
        timezone: 'Asia/Seoul',
        runAt: ['00:35', '04:35', '08:35', '12:35', '16:35', '20:35'],
      },
      {
        task: 'balanceRecommendationNew',
        cronExpression: '0 35 6 * * *',
        timezone: 'Asia/Seoul',
        runAt: ['06:35'],
      },
    ]);
  });

  it('should return started when lock is acquired', async () => {
    redlockService.startWithLock.mockResolvedValue(true);

    const result = await service.executeMarketRecommendation();

    expect(result.status).toBe('started');
    expect(redlockService.startWithLock).toHaveBeenCalledWith(
      'MarketResearchService:executeMarketRecommendation',
      88_200_000,
      expect.any(Function),
    );
  });

  it('should return skipped_lock when lock is not acquired', async () => {
    redlockService.startWithLock.mockResolvedValue(false);

    const result = await service.executeBalanceRecommendationExisting();

    expect(result.status).toBe('skipped_lock');
    expect(redlockService.startWithLock).toHaveBeenCalledWith(
      'RebalanceService:executeBalanceRecommendationExisting',
      3_600_000,
      expect.any(Function),
    );
  });

  it('should execute the correct callback when lock runner invokes it', async () => {
    redlockService.startWithLock.mockImplementation(
      async (_resourceName: string, _duration: number, callback: () => Promise<void>) => {
        await callback();
        return true;
      },
    );

    await service.executeBalanceRecommendationNew();

    expect(rebalanceService.executeBalanceRecommendationNewTask).toHaveBeenCalledTimes(1);
  });

  it('should propagate start-stage errors', async () => {
    redlockService.startWithLock.mockRejectedValue(new Error('boom'));

    await expect(service.executeBalanceRecommendationNew()).rejects.toThrow('boom');
  });
});
