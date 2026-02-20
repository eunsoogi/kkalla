export type ScheduleExecutionTask =
  | 'marketRecommendation'
  | 'balanceRecommendationExisting'
  | 'balanceRecommendationNew'
  | 'reportValidation';

export type ScheduleExecutionStatus = 'started' | 'skipped_lock';

export interface ScheduleExecutionResponse {
  task: ScheduleExecutionTask;
  status: ScheduleExecutionStatus;
  requestedAt: string;
}

export interface ScheduleExecutionPlanResponse {
  task: ScheduleExecutionTask;
  cronExpression: string;
  timezone: string;
  runAt: string[];
}

export interface ScheduleLockStateResponse {
  task: ScheduleExecutionTask;
  locked: boolean;
  ttlMs: number | null;
  checkedAt: string;
}

export interface ScheduleLockReleaseResponse {
  task: ScheduleExecutionTask;
  released: boolean;
  locked: boolean;
  releasedAt: string;
  recoveredRunningCount?: number;
}
