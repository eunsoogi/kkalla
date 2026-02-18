import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { ScheduleExpression as MarketResearchScheduleExpression } from '../market-research/market-research.enum';
import { MarketResearchService } from '../market-research/market-research.service';
import { ScheduleExpression as RebalanceScheduleExpression } from '../rebalance/rebalance.enum';
import { RebalanceService } from '../rebalance/rebalance.service';
import { RedlockService } from '../redlock/redlock.service';
import { ScheduleExecutionResponse, ScheduleExecutionTask } from './schedule-execution.interface';
import { SchedulePlanResponse } from './schedule-plan.interface';

interface LockConfig {
  resourceName: string;
  duration: number;
}

@Injectable()
export class ScheduleExecutionService {
  private readonly timezone = 'Asia/Seoul';

  private readonly marketRecommendationLock: LockConfig = {
    resourceName: 'MarketResearchService:executeMarketRecommendation',
    duration: 88_200_000,
  };

  private readonly balanceRecommendationExistingLock: LockConfig = {
    resourceName: 'RebalanceService:executeBalanceRecommendationExisting',
    duration: 3_600_000,
  };

  private readonly balanceRecommendationNewLock: LockConfig = {
    resourceName: 'RebalanceService:executeBalanceRecommendationNew',
    duration: 3_600_000,
  };

  constructor(
    @Inject(forwardRef(() => MarketResearchService))
    private readonly marketResearchService: MarketResearchService,
    @Inject(forwardRef(() => RebalanceService))
    private readonly rebalanceService: RebalanceService,
    private readonly redlockService: RedlockService,
  ) {}

  public getExecutionPlans(): SchedulePlanResponse[] {
    const plans: Array<{ task: ScheduleExecutionTask; cronExpression: string }> = [
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
    ];

    return plans.map((plan) => ({
      ...plan,
      timezone: this.timezone,
      runAt: this.extractRunAtTimes(plan.cronExpression),
    }));
  }

  public async executeMarketRecommendation(): Promise<ScheduleExecutionResponse> {
    return this.executeWithLock('marketRecommendation', this.marketRecommendationLock, () =>
      this.marketResearchService.executeMarketRecommendationTask(),
    );
  }

  public async executeBalanceRecommendationExisting(): Promise<ScheduleExecutionResponse> {
    return this.executeWithLock('balanceRecommendationExisting', this.balanceRecommendationExistingLock, () =>
      this.rebalanceService.executeBalanceRecommendationExistingTask(),
    );
  }

  public async executeBalanceRecommendationNew(): Promise<ScheduleExecutionResponse> {
    return this.executeWithLock('balanceRecommendationNew', this.balanceRecommendationNewLock, () =>
      this.rebalanceService.executeBalanceRecommendationNewTask(),
    );
  }

  private async executeWithLock(
    task: ScheduleExecutionTask,
    lock: LockConfig,
    callback: () => Promise<void>,
  ): Promise<ScheduleExecutionResponse> {
    const requestedAt = new Date().toISOString();

    if (process.env.NODE_ENV === 'development') {
      return {
        task,
        status: 'skipped_development',
        requestedAt,
      };
    }

    const started = await this.redlockService.startWithLock(lock.resourceName, lock.duration, callback);

    return {
      task,
      status: started ? 'started' : 'skipped_lock',
      requestedAt,
    };
  }

  private extractRunAtTimes(cronExpression: string): string[] {
    const fields = cronExpression.split(' ');
    const minuteField = fields[1];
    const hourField = fields[2];

    if (!minuteField || !hourField || !/^\d+$/.test(minuteField)) {
      return [];
    }

    const minute = Number(minuteField);
    const hours = hourField
      .split(',')
      .filter((hour) => /^\d+$/.test(hour))
      .map((hour) => Number(hour))
      .sort((a, b) => a - b);

    return hours.map((hour) => `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
  }
}
