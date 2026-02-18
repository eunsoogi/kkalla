import { ScheduleExecutionTask } from './schedule-execution.interface';

export interface SchedulePlanResponse {
  task: ScheduleExecutionTask;
  cronExpression: string;
  timezone: string;
  runAt: string[];
}
