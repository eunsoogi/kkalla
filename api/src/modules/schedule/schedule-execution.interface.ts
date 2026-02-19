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
