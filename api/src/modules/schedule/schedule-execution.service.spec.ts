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
    requeueRunningValidationsToPending: jest.Mock;
  };
  let redlockService: {
    startWithLock: jest.Mock;
    getLockStatus: jest.Mock;
    forceReleaseLock: jest.Mock;
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
      requeueRunningValidationsToPending: jest.fn().mockResolvedValue(0),
    };
    redlockService = {
      startWithLock: jest.fn().mockResolvedValue(true),
      getLockStatus: jest.fn().mockResolvedValue({
        locked: false,
        ttlMs: null,
      }),
      forceReleaseLock: jest.fn().mockResolvedValue(false),
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

  it('should return lock states by task', async () => {
    redlockService.getLockStatus
      .mockResolvedValueOnce({ locked: true, ttlMs: 10_000 })
      .mockResolvedValueOnce({ locked: false, ttlMs: null });

    const lockStates = await service.getLockStates(['marketRecommendation', 'reportValidation']);

    expect(redlockService.getLockStatus).toHaveBeenNthCalledWith(
      1,
      'MarketResearchService:executeMarketRecommendation',
    );
    expect(redlockService.getLockStatus).toHaveBeenNthCalledWith(2, 'ReportValidationService:executeDueValidations');
    expect(lockStates).toHaveLength(2);
    expect(lockStates[0]?.task).toBe('marketRecommendation');
    expect(lockStates[0]?.locked).toBe(true);
    expect(lockStates[0]?.ttlMs).toBe(10_000);
    expect(lockStates[1]?.task).toBe('reportValidation');
    expect(lockStates[1]?.locked).toBe(false);
  });

  it('should release task lock and return updated state', async () => {
    redlockService.forceReleaseLock.mockResolvedValue(true);
    redlockService.getLockStatus.mockResolvedValue({
      locked: false,
      ttlMs: null,
    });

    const result = await service.releaseLock('balanceRecommendationExisting');

    expect(redlockService.forceReleaseLock).toHaveBeenCalledWith(
      'RebalanceService:executeBalanceRecommendationExisting',
    );
    expect(redlockService.getLockStatus).toHaveBeenCalledWith('RebalanceService:executeBalanceRecommendationExisting');
    expect(result.task).toBe('balanceRecommendationExisting');
    expect(result.released).toBe(true);
    expect(result.locked).toBe(false);
    expect(result.recoveredRunningCount).toBeUndefined();
    expect(reportValidationService.requeueRunningValidationsToPending).not.toHaveBeenCalled();
  });

  it('should recover running report validation items after lock release when unlocked', async () => {
    redlockService.forceReleaseLock.mockResolvedValue(true);
    redlockService.getLockStatus.mockResolvedValue({
      locked: false,
      ttlMs: null,
    });
    reportValidationService.requeueRunningValidationsToPending.mockResolvedValue(12);

    const result = await service.releaseLock('reportValidation');

    expect(redlockService.forceReleaseLock).toHaveBeenCalledWith('ReportValidationService:executeDueValidations');
    expect(reportValidationService.requeueRunningValidationsToPending).toHaveBeenCalledTimes(1);
    expect(result.task).toBe('reportValidation');
    expect(result.recoveredRunningCount).toBe(12);
  });

  it('should skip report validation recovery when lock remains locked', async () => {
    redlockService.forceReleaseLock.mockResolvedValue(false);
    redlockService.getLockStatus.mockResolvedValue({
      locked: true,
      ttlMs: 30_000,
    });

    const result = await service.releaseLock('reportValidation');

    expect(reportValidationService.requeueRunningValidationsToPending).not.toHaveBeenCalled();
    expect(result.recoveredRunningCount).toBeUndefined();
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
