import { MarketResearchService } from '../market-research/market-research.service';
import { RebalanceService } from '../rebalance/rebalance.service';
import { RedlockService } from '../redlock/redlock.service';
import { ReportValidationService } from '../report-validation/report-validation.service';
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
  let reportValidationService: {
    executeDueValidationsTask: jest.Mock;
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
    reportValidationService = {
      executeDueValidationsTask: jest.fn().mockResolvedValue(undefined),
    };
    redlockService = {
      startWithLock: jest.fn().mockResolvedValue(true),
    };

    process.env.NODE_ENV = 'test';
    service = new ScheduleExecutionService(
      marketResearchService as unknown as MarketResearchService,
      rebalanceService as unknown as RebalanceService,
      reportValidationService as unknown as ReportValidationService,
      redlockService as unknown as RedlockService,
    );
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('should still attempt lock acquisition in development mode for manual execution', async () => {
    process.env.NODE_ENV = 'development';

    const result = await service.executeMarketRecommendation();

    expect(redlockService.startWithLock).toHaveBeenCalledWith(
      'MarketResearchService:executeMarketRecommendation',
      88_200_000,
      expect.any(Function),
    );
    expect(result.task).toBe('marketRecommendation');
    expect(result.status).toBe('started');
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
      {
        task: 'reportValidation',
        cronExpression: '0 15 * * * *',
        timezone: 'Asia/Seoul',
        runAt: [
          '00:15',
          '01:15',
          '02:15',
          '03:15',
          '04:15',
          '05:15',
          '06:15',
          '07:15',
          '08:15',
          '09:15',
          '10:15',
          '11:15',
          '12:15',
          '13:15',
          '14:15',
          '15:15',
          '16:15',
          '17:15',
          '18:15',
          '19:15',
          '20:15',
          '21:15',
          '22:15',
          '23:15',
        ],
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

  it('should execute report validation task with lock', async () => {
    redlockService.startWithLock.mockImplementation(
      async (_resourceName: string, _duration: number, callback: () => Promise<void>) => {
        await callback();
        return true;
      },
    );

    const result = await service.executeReportValidation();

    expect(result.status).toBe('started');
    expect(reportValidationService.executeDueValidationsTask).toHaveBeenCalledTimes(1);
  });
});
