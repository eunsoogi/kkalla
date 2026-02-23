import { AllocationAuditService } from '../allocation-audit/allocation-audit.service';
import { AllocationService } from '../allocation/allocation.service';
import { MarketIntelligenceService } from '../market-intelligence/market-intelligence.service';
import { RedlockService } from '../redlock/redlock.service';
import { ScheduleExecutionService } from './schedule-execution.service';

describe('ScheduleExecutionService', () => {
  let service: ScheduleExecutionService;
  let marketIntelligenceService: {
    executeMarketSignalTask: jest.Mock;
  };
  let allocationService: {
    executeAllocationRecommendationExistingTask: jest.Mock;
    executeAllocationRecommendationNewTask: jest.Mock;
  };
  let allocationAuditService: {
    executeDueAuditsTask: jest.Mock;
    requeueRunningAuditsToPending: jest.Mock;
  };
  let redlockService: {
    startWithLock: jest.Mock;
    getLockStatus: jest.Mock;
    forceReleaseLock: jest.Mock;
  };
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    marketIntelligenceService = {
      executeMarketSignalTask: jest.fn().mockResolvedValue(undefined),
    };
    allocationService = {
      executeAllocationRecommendationExistingTask: jest.fn().mockResolvedValue(undefined),
      executeAllocationRecommendationNewTask: jest.fn().mockResolvedValue(undefined),
    };
    allocationAuditService = {
      executeDueAuditsTask: jest.fn().mockResolvedValue(undefined),
      requeueRunningAuditsToPending: jest.fn().mockResolvedValue(0),
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
      marketIntelligenceService as unknown as MarketIntelligenceService,
      allocationService as unknown as AllocationService,
      allocationAuditService as unknown as AllocationAuditService,
      redlockService as unknown as RedlockService,
    );
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('should still attempt lock acquisition in development mode for manual execution', async () => {
    process.env.NODE_ENV = 'development';

    const result = await service.executeMarketSignal();

    expect(redlockService.startWithLock).toHaveBeenCalledWith(
      'MarketIntelligenceService:executeMarketSignal',
      88_200_000,
      expect.any(Function),
    );
    expect(result.task).toBe('marketSignal');
    expect(result.status).toBe('started');
  });

  it('should return configured execution plans with cron and run times', () => {
    const plans = service.getExecutionPlans();

    expect(plans).toEqual([
      {
        task: 'marketSignal',
        cronExpression: '0 0 0 * * *',
        timezone: 'Asia/Seoul',
        runAt: ['00:00'],
      },
      {
        task: 'allocationRecommendationExisting',
        cronExpression: '0 35 0,4,8,12,16,20 * * *',
        timezone: 'Asia/Seoul',
        runAt: ['00:35', '04:35', '08:35', '12:35', '16:35', '20:35'],
      },
      {
        task: 'allocationRecommendationNew',
        cronExpression: '0 35 6 * * *',
        timezone: 'Asia/Seoul',
        runAt: ['06:35'],
      },
      {
        task: 'allocationAudit',
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

    const lockStates = await service.getLockStates(['marketSignal', 'allocationAudit']);

    expect(redlockService.getLockStatus).toHaveBeenNthCalledWith(1, 'MarketIntelligenceService:executeMarketSignal');
    expect(redlockService.getLockStatus).toHaveBeenNthCalledWith(2, 'AllocationAuditService:executeDueAudits');
    expect(lockStates).toHaveLength(2);
    expect(lockStates[0]?.task).toBe('marketSignal');
    expect(lockStates[0]?.locked).toBe(true);
    expect(lockStates[0]?.ttlMs).toBe(10_000);
    expect(lockStates[1]?.task).toBe('allocationAudit');
    expect(lockStates[1]?.locked).toBe(false);
  });

  it('should release task lock and return updated state', async () => {
    redlockService.forceReleaseLock.mockResolvedValue(true);
    redlockService.getLockStatus.mockResolvedValue({
      locked: false,
      ttlMs: null,
    });

    const result = await service.releaseLock('allocationRecommendationExisting');

    expect(redlockService.forceReleaseLock).toHaveBeenCalledWith(
      'AllocationService:executeAllocationRecommendationExisting',
    );
    expect(redlockService.getLockStatus).toHaveBeenCalledWith(
      'AllocationService:executeAllocationRecommendationExisting',
    );
    expect(result.task).toBe('allocationRecommendationExisting');
    expect(result.released).toBe(true);
    expect(result.locked).toBe(false);
    expect(result.recoveredRunningCount).toBeUndefined();
    expect(allocationAuditService.requeueRunningAuditsToPending).not.toHaveBeenCalled();
  });

  it('should recover running report validation items after lock release when unlocked', async () => {
    redlockService.forceReleaseLock.mockResolvedValue(true);
    redlockService.getLockStatus.mockResolvedValue({
      locked: false,
      ttlMs: null,
    });
    allocationAuditService.requeueRunningAuditsToPending.mockResolvedValue(12);

    const result = await service.releaseLock('allocationAudit');

    expect(redlockService.forceReleaseLock).toHaveBeenCalledWith('AllocationAuditService:executeDueAudits');
    expect(allocationAuditService.requeueRunningAuditsToPending).toHaveBeenCalledTimes(1);
    expect(result.task).toBe('allocationAudit');
    expect(result.recoveredRunningCount).toBe(12);
  });

  it('should skip report validation recovery when lock remains locked', async () => {
    redlockService.forceReleaseLock.mockResolvedValue(false);
    redlockService.getLockStatus.mockResolvedValue({
      locked: true,
      ttlMs: 30_000,
    });

    const result = await service.releaseLock('allocationAudit');

    expect(allocationAuditService.requeueRunningAuditsToPending).not.toHaveBeenCalled();
    expect(result.recoveredRunningCount).toBeUndefined();
  });

  it('should return started when lock is acquired', async () => {
    redlockService.startWithLock.mockResolvedValue(true);

    const result = await service.executeMarketSignal();

    expect(result.status).toBe('started');
    expect(redlockService.startWithLock).toHaveBeenCalledWith(
      'MarketIntelligenceService:executeMarketSignal',
      88_200_000,
      expect.any(Function),
    );
  });

  it('should return skipped_lock when lock is not acquired', async () => {
    redlockService.startWithLock.mockResolvedValue(false);

    const result = await service.executeAllocationRecommendationExisting();

    expect(result.status).toBe('skipped_lock');
    expect(redlockService.startWithLock).toHaveBeenCalledWith(
      'AllocationService:executeAllocationRecommendationExisting',
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

    await service.executeAllocationRecommendationNew();

    expect(allocationService.executeAllocationRecommendationNewTask).toHaveBeenCalledTimes(1);
  });

  it('should propagate start-stage errors', async () => {
    redlockService.startWithLock.mockRejectedValue(new Error('boom'));

    await expect(service.executeAllocationRecommendationNew()).rejects.toThrow('boom');
  });

  it('should execute report validation task with lock', async () => {
    redlockService.startWithLock.mockImplementation(
      async (_resourceName: string, _duration: number, callback: () => Promise<void>) => {
        await callback();
        return true;
      },
    );

    const result = await service.executeAllocationAudit();

    expect(result.status).toBe('started');
    expect(allocationAuditService.executeDueAuditsTask).toHaveBeenCalledTimes(1);
  });
});
