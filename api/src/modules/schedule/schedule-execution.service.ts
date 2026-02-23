import { Inject, Injectable, forwardRef } from '@nestjs/common';

import {
  ALLOCATION_AUDIT_EXECUTE_DUE_VALIDATIONS_LOCK,
  ScheduleExpression as AllocationAuditScheduleExpression,
} from '../allocation-audit/allocation-audit.enum';
import { AllocationAuditService } from '../allocation-audit/allocation-audit.service';
import {
  ALLOCATION_RECOMMENDATION_EXISTING_LOCK,
  ALLOCATION_RECOMMENDATION_NEW_LOCK,
  ScheduleExpression as AllocationScheduleExpression,
} from '../allocation/allocation.enum';
import { AllocationService } from '../allocation/allocation.service';
import {
  MARKET_SIGNAL_LOCK,
  ScheduleExpression as MarketIntelligenceScheduleExpression,
} from '../market-intelligence/market-intelligence.enum';
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
  compatibleResourceNames?: string[];
  duration: number;
}

@Injectable()
export class ScheduleExecutionService {
  private readonly timezone = 'Asia/Seoul';

  // Each task keeps both canonical and compatibility lock names to bridge rolling updates.
  private readonly lockConfigByTask: Record<ScheduleExecutionTask, LockConfig> = {
    marketSignal: {
      resourceName: MARKET_SIGNAL_LOCK.resourceName,
      compatibleResourceNames: [...MARKET_SIGNAL_LOCK.compatibleResourceNames],
      duration: MARKET_SIGNAL_LOCK.duration,
    },
    allocationRecommendationExisting: {
      resourceName: ALLOCATION_RECOMMENDATION_EXISTING_LOCK.resourceName,
      compatibleResourceNames: [...ALLOCATION_RECOMMENDATION_EXISTING_LOCK.compatibleResourceNames],
      duration: ALLOCATION_RECOMMENDATION_EXISTING_LOCK.duration,
    },
    allocationRecommendationNew: {
      resourceName: ALLOCATION_RECOMMENDATION_NEW_LOCK.resourceName,
      compatibleResourceNames: [...ALLOCATION_RECOMMENDATION_NEW_LOCK.compatibleResourceNames],
      duration: ALLOCATION_RECOMMENDATION_NEW_LOCK.duration,
    },
    allocationAudit: {
      resourceName: ALLOCATION_AUDIT_EXECUTE_DUE_VALIDATIONS_LOCK.resourceName,
      compatibleResourceNames: [...ALLOCATION_AUDIT_EXECUTE_DUE_VALIDATIONS_LOCK.compatibleResourceNames],
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

  /**
   * Retrieves execution plans for the schedule execution flow.
   * @returns Processed collection for downstream workflow steps.
   */
  public getExecutionPlans(): SchedulePlanResponse[] {
    return this.executionPlans.map((plan) => ({
      ...plan,
      timezone: this.timezone,
      runAt: this.extractRunAtTimes(plan.cronExpression),
    }));
  }

  /**
   * Retrieves lock states for the schedule execution flow.
   * @param tasks - Task identifier to execute.
   * @returns Processed collection for downstream workflow steps.
   */
  public async getLockStates(tasks: ScheduleExecutionTask[]): Promise<ScheduleLockStateResponse[]> {
    const checkedAt = new Date().toISOString();

    const lockStateEntries = await Promise.all(
      tasks.map(async (task) => {
        const lock = this.getLockConfig(task);
        const lockStatus = await this.getAggregatedLockStatus(lock);

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

  /**
   * Runs release lock in the schedule execution workflow.
   * @param task - Task identifier to execute.
   * @returns Asynchronous result produced by the schedule execution flow.
   */
  public async releaseLock(task: ScheduleExecutionTask): Promise<ScheduleLockReleaseResponse> {
    const lock = this.getLockConfig(task);
    const releaseResults = await Promise.all(
      this.getLockResourceNames(lock).map((resourceName) => this.redlockService.forceReleaseLock(resourceName)),
    );
    const released = releaseResults.some((result) => result);
    const lockStatus = await this.getAggregatedLockStatus(lock);
    // Allocation audit can leave "running" rows when locks are force-released; recover them immediately.
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

  /**
   * Runs market signal in the schedule execution workflow.
   * @returns Asynchronous result produced by the schedule execution flow.
   */
  public async executeMarketSignal(): Promise<ScheduleExecutionResponse> {
    return this.executeWithLock('marketSignal', this.getLockConfig('marketSignal'), () =>
      this.marketIntelligenceService.executeMarketSignalTask(),
    );
  }

  /**
   * Runs allocation recommendation existing in the schedule execution workflow.
   * @returns Asynchronous result produced by the schedule execution flow.
   */
  public async executeAllocationRecommendationExisting(): Promise<ScheduleExecutionResponse> {
    return this.executeWithLock(
      'allocationRecommendationExisting',
      this.getLockConfig('allocationRecommendationExisting'),
      () => this.allocationService.executeAllocationRecommendationExistingTask(),
    );
  }

  /**
   * Runs allocation recommendation new in the schedule execution workflow.
   * @returns Asynchronous result produced by the schedule execution flow.
   */
  public async executeAllocationRecommendationNew(): Promise<ScheduleExecutionResponse> {
    return this.executeWithLock('allocationRecommendationNew', this.getLockConfig('allocationRecommendationNew'), () =>
      this.allocationService.executeAllocationRecommendationNewTask(),
    );
  }

  /**
   * Runs allocation audit in the schedule execution workflow.
   * @returns Asynchronous result produced by the schedule execution flow.
   */
  public async executeAllocationAudit(): Promise<ScheduleExecutionResponse> {
    return this.executeWithLock('allocationAudit', this.getLockConfig('allocationAudit'), () =>
      this.allocationAuditService.executeDueAuditsTask(),
    );
  }

  /**
   * Runs with lock in the schedule execution workflow.
   * @param task - Task identifier to execute.
   * @param lock - Lock data used for concurrency control.
   * @param callback - Callback invoked within the workflow.
   * @returns Asynchronous result produced by the schedule execution flow.
   */
  private async executeWithLock(
    task: ScheduleExecutionTask,
    lock: LockConfig,
    callback: () => Promise<void>,
  ): Promise<ScheduleExecutionResponse> {
    const requestedAt = new Date().toISOString();
    const started = await this.redlockService.startWithLocks(this.getLockResourceNames(lock), lock.duration, callback);

    return {
      task,
      status: started ? 'started' : 'skipped_lock',
      requestedAt,
    };
  }

  /**
   * Retrieves lock config for the schedule execution flow.
   * @param task - Task identifier to execute.
   * @returns Result produced by the schedule execution flow.
   */
  private getLockConfig(task: ScheduleExecutionTask): LockConfig {
    return this.lockConfigByTask[task];
  }

  /**
   * Retrieves lock resource names for the schedule execution flow.
   * @param lock - Lock data used for concurrency control.
   * @returns Formatted string output for the operation.
   */
  private getLockResourceNames(lock: LockConfig): string[] {
    return [lock.resourceName, ...(lock.compatibleResourceNames ?? [])];
  }

  /**
   * Retrieves aggregated lock status for the schedule execution flow.
   * @param lock - Lock data used for concurrency control.
   * @returns Boolean flag that indicates whether the condition is satisfied.
   */
  private async getAggregatedLockStatus(lock: LockConfig): Promise<{ locked: boolean; ttlMs: number | null }> {
    const statuses = await Promise.all(
      this.getLockResourceNames(lock).map((resourceName) => this.redlockService.getLockStatus(resourceName)),
    );

    // Treat any locked compatibility key as locked for the logical task.
    const lockedStatuses = statuses.filter((status) => status.locked);
    if (lockedStatuses.length < 1) {
      return {
        locked: false,
        ttlMs: null,
      };
    }

    const hasUnknownTtl = lockedStatuses.some((status) => status.ttlMs == null);
    if (hasUnknownTtl) {
      return {
        locked: true,
        ttlMs: null,
      };
    }

    return {
      locked: true,
      ttlMs: Math.max(...lockedStatuses.map((status) => status.ttlMs ?? 0)),
    };
  }

  /**
   * Handles extract run at times in the schedule execution workflow.
   * @param cronExpression - Input value for cron expression.
   * @returns Formatted string output for the operation.
   */
  private extractRunAtTimes(cronExpression: string): string[] {
    const fields = cronExpression.split(' ');
    const minuteField = fields[1];
    const hourField = fields[2];

    // UI preview only supports fixed-minute cron patterns from our schedule enums.
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
