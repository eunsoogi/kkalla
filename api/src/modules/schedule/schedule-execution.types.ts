export type ScheduleExecutionTask =
  | 'marketSignal'
  | 'allocationRecommendationExisting'
  | 'allocationRecommendationNew'
  | 'allocationAudit';

export type ScheduleExecutionStatus = 'started' | 'skipped_lock';

export interface LockConfig {
  resourceName: string;
  compatibleResourceNames?: string[];
  duration: number;
}

export interface ScheduleExecutionResponse {
  task: ScheduleExecutionTask;
  status: ScheduleExecutionStatus;
  requestedAt: string;
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
