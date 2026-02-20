import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { ScheduleExpression as MarketResearchScheduleExpression } from '../market-research/market-research.enum';
import { MarketResearchService } from '../market-research/market-research.service';
import { ScheduleExpression as RebalanceScheduleExpression } from '../rebalance/rebalance.enum';
import { RebalanceService } from '../rebalance/rebalance.service';
import { RedlockService } from '../redlock/redlock.service';
import {
  REPORT_VALIDATION_EXECUTE_DUE_VALIDATIONS_LOCK,
  ScheduleExpression as ReportValidationScheduleExpression,
} from '../report-validation/report-validation.enum';
import { ReportValidationService } from '../report-validation/report-validation.service';
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
    marketRecommendation: {
      resourceName: 'MarketResearchService:executeMarketRecommendation',
      duration: 88_200_000,
    },
    balanceRecommendationExisting: {
      resourceName: 'RebalanceService:executeBalanceRecommendationExisting',
      duration: 3_600_000,
    },
    balanceRecommendationNew: {
      resourceName: 'RebalanceService:executeBalanceRecommendationNew',
      duration: 3_600_000,
    },
    reportValidation: {
      resourceName: REPORT_VALIDATION_EXECUTE_DUE_VALIDATIONS_LOCK.resourceName,
      duration: REPORT_VALIDATION_EXECUTE_DUE_VALIDATIONS_LOCK.duration,
    },
  };

  private readonly executionPlans: Array<{ task: ScheduleExecutionTask; cronExpression: string }> = [
    {
      task: 'marketRecommendation',
      cronExpression: MarketResearchScheduleExpression.DAILY_MARKET_RECOMMENDATION,
    },
    {
      task: 'balanceRecommendationExisting',
      cronExpression: RebalanceScheduleExpression.DAILY_BALANCE_RECOMMENDATION_EXISTING,
    },
    {
      task: 'balanceRecommendationNew',
      cronExpression: RebalanceScheduleExpression.DAILY_BALANCE_RECOMMENDATION_NEW,
    },
    {
      task: 'reportValidation',
      cronExpression: ReportValidationScheduleExpression.HOURLY_REPORT_VALIDATION,
    },
  ];

  constructor(
    @Inject(forwardRef(() => MarketResearchService))
    private readonly marketResearchService: MarketResearchService,
    @Inject(forwardRef(() => RebalanceService))
    private readonly rebalanceService: RebalanceService,
    private readonly reportValidationService: ReportValidationService,
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
      task === 'reportValidation' && !lockStatus.locked
        ? await this.reportValidationService.requeueRunningValidationsToPending()
        : undefined;

    return {
      task,
      released,
      locked: lockStatus.locked,
      releasedAt: new Date().toISOString(),
      recoveredRunningCount,
    };
  }

  public async executeMarketRecommendation(): Promise<ScheduleExecutionResponse> {
    return this.executeWithLock('marketRecommendation', this.getLockConfig('marketRecommendation'), () =>
      this.marketResearchService.executeMarketRecommendationTask(),
    );
  }

  public async executeBalanceRecommendationExisting(): Promise<ScheduleExecutionResponse> {
    return this.executeWithLock(
      'balanceRecommendationExisting',
      this.getLockConfig('balanceRecommendationExisting'),
      () => this.rebalanceService.executeBalanceRecommendationExistingTask(),
    );
  }

  public async executeBalanceRecommendationNew(): Promise<ScheduleExecutionResponse> {
    return this.executeWithLock('balanceRecommendationNew', this.getLockConfig('balanceRecommendationNew'), () =>
      this.rebalanceService.executeBalanceRecommendationNewTask(),
    );
  }

  public async executeReportValidation(): Promise<ScheduleExecutionResponse> {
    return this.executeWithLock('reportValidation', this.getLockConfig('reportValidation'), () =>
      this.reportValidationService.executeDueValidationsTask(),
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
