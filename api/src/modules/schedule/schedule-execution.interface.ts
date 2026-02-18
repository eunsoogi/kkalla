export type ScheduleExecutionTask =
  | 'marketRecommendation'
  | 'balanceRecommendationExisting'
  | 'balanceRecommendationNew';

export type ScheduleExecutionStatus = 'started' | 'skipped_lock' | 'skipped_development';

export interface ScheduleExecutionResponse {
  task: ScheduleExecutionTask;
  status: ScheduleExecutionStatus;
  requestedAt: string;
}
