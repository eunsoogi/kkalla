import { Inject, Injectable, forwardRef } from '@nestjs/common';

import {
  ALLOCATION_AUDIT_EXECUTE_DUE_VALIDATIONS_LOCK,
  ScheduleExpression as AllocationAuditScheduleExpression,
} from '../allocation-audit/allocation-audit.enum';
import { AllocationAuditService } from '../allocation-audit/allocation-audit.service';
import { ScheduleExpression as AllocationScheduleExpression } from '../allocation/allocation.enum';
import { AllocationService } from '../allocation/allocation.service';
import { ScheduleExpression as MarketIntelligenceScheduleExpression } from '../market-intelligence/market-intelligence.enum';
import { MarketIntelligenceService } from '../market-intelligence/market-intelligence.service';
import { RedlockService } from '../redlock/redlock.service';
import {
  ScheduleExecutionResponse,
  ScheduleExecutionTask,
  ScheduleLockReleaseResponse,
  ScheduleLockStateResponse,
} from './schedule-execution.interface';
import { SchedulePlanResponse } from './schedule-plan.interface';

interface LockConfig {
  resourceName: string;
  duration: number;
}

@Injectable()
export class ScheduleExecutionService {
  private readonly timezone = 'Asia/Seoul';

  private readonly lockConfigByTask: Record<ScheduleExecutionTask, LockConfig> = {
    marketSignal: {
      resourceName: 'MarketIntelligenceService:executeMarketSignal',
      duration: 88_200_000,
    },
    allocationRecommendationExisting: {
      resourceName: 'AllocationService:executeAllocationRecommendationExisting',
      duration: 3_600_000,
    },
    allocationRecommendationNew: {
      resourceName: 'AllocationService:executeAllocationRecommendationNew',
      duration: 3_600_000,
    },
    allocationAudit: {
      resourceName: ALLOCATION_AUDIT_EXECUTE_DUE_VALIDATIONS_LOCK.resourceName,
      duration: ALLOCATION_AUDIT_EXECUTE_DUE_VALIDATIONS_LOCK.duration,
    },
  };

  private readonly executionPlans: Array<{ task: ScheduleExecutionTask; cronExpression: string }> = [
    {
      task: 'marketSignal',
      cronExpression: MarketIntelligenceScheduleExpression.DAILY_MARKET_SIGNAL,
    },
    {
      task: 'allocationRecommendationExisting',
      cronExpression: AllocationScheduleExpression.DAILY_ALLOCATION_RECOMMENDATION_EXISTING,
    },
    {
      task: 'allocationRecommendationNew',
      cronExpression: AllocationScheduleExpression.DAILY_ALLOCATION_RECOMMENDATION_NEW,
    },
    {
      task: 'allocationAudit',
      cronExpression: AllocationAuditScheduleExpression.HOURLY_ALLOCATION_AUDIT,
    },
  ];

  constructor(
    @Inject(forwardRef(() => MarketIntelligenceService))
    private readonly marketIntelligenceService: MarketIntelligenceService,
    @Inject(forwardRef(() => AllocationService))
    private readonly allocationService: AllocationService,
    private readonly allocationAuditService: AllocationAuditService,
    private readonly redlockService: RedlockService,
  ) {}

  public getExecutionPlans(): SchedulePlanResponse[] {
    return this.executionPlans.map((plan) => ({
      ...plan,
      timezone: this.timezone,
      runAt: this.extractRunAtTimes(plan.cronExpression),
    }));
  }

  public async getLockStates(tasks: ScheduleExecutionTask[]): Promise<ScheduleLockStateResponse[]> {
    const checkedAt = new Date().toISOString();

    const lockStateEntries = await Promise.all(
      tasks.map(async (task) => {
        const lock = this.getLockConfig(task);
        const lockStatus = await this.redlockService.getLockStatus(lock.resourceName);

        return {
          task,
          lockStatus,
        };
      }),
    );

    return lockStateEntries.map(({ task, lockStatus }) => ({
      task,
      locked: lockStatus.locked,
      ttlMs: lockStatus.ttlMs,
      checkedAt,
    }));
  }

  public async releaseLock(task: ScheduleExecutionTask): Promise<ScheduleLockReleaseResponse> {
    const lock = this.getLockConfig(task);
    const released = await this.redlockService.forceReleaseLock(lock.resourceName);
    const lockStatus = await this.redlockService.getLockStatus(lock.resourceName);
    const recoveredRunningCount =
      task === 'allocationAudit' && !lockStatus.locked
        ? await this.allocationAuditService.requeueRunningAuditsToPending()
        : undefined;

    return {
      task,
      released,
      locked: lockStatus.locked,
      releasedAt: new Date().toISOString(),
      recoveredRunningCount,
    };
  }

  public async executeMarketSignal(): Promise<ScheduleExecutionResponse> {
    return this.executeWithLock('marketSignal', this.getLockConfig('marketSignal'), () =>
      this.marketIntelligenceService.executeMarketSignalTask(),
    );
  }

  public async executeAllocationRecommendationExisting(): Promise<ScheduleExecutionResponse> {
    return this.executeWithLock(
      'allocationRecommendationExisting',
      this.getLockConfig('allocationRecommendationExisting'),
      () => this.allocationService.executeAllocationRecommendationExistingTask(),
    );
  }

  public async executeAllocationRecommendationNew(): Promise<ScheduleExecutionResponse> {
    return this.executeWithLock('allocationRecommendationNew', this.getLockConfig('allocationRecommendationNew'), () =>
      this.allocationService.executeAllocationRecommendationNewTask(),
    );
  }

  public async executeAllocationAudit(): Promise<ScheduleExecutionResponse> {
    return this.executeWithLock('allocationAudit', this.getLockConfig('allocationAudit'), () =>
      this.allocationAuditService.executeDueAuditsTask(),
    );
  }

  private async executeWithLock(
    task: ScheduleExecutionTask,
    lock: LockConfig,
    callback: () => Promise<void>,
  ): Promise<ScheduleExecutionResponse> {
    const requestedAt = new Date().toISOString();

    const started = await this.redlockService.startWithLock(lock.resourceName, lock.duration, callback);

    return {
      task,
      status: started ? 'started' : 'skipped_lock',
      requestedAt,
    };
  }

  private getLockConfig(task: ScheduleExecutionTask): LockConfig {
    return this.lockConfigByTask[task];
  }

  private extractRunAtTimes(cronExpression: string): string[] {
    const fields = cronExpression.split(' ');
    const minuteField = fields[1];
    const hourField = fields[2];

    if (!minuteField || !hourField || !/^\d+$/.test(minuteField)) {
      return [];
    }

    const minute = Number(minuteField);
    const hours =
      hourField === '*'
        ? Array.from({ length: 24 }, (_, index) => index)
        : hourField
            .split(',')
            .filter((hour) => /^\d+$/.test(hour))
            .map((hour) => Number(hour))
            .sort((a, b) => a - b);

    return hours.map((hour) => `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
  }
}
