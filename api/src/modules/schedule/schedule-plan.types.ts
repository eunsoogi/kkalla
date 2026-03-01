import { ScheduleExecutionTask } from './schedule-execution.types';

export interface SchedulePlanResponse {
  task: ScheduleExecutionTask;
  cronExpression: string;
  timezone: string;
  runAt: string[];
}
