import type { ScheduleExecutionTask } from './schedule-execution.types';

export interface NextRunHighlight {
  task: ScheduleExecutionTask;
  time: string;
  timezone: string;
  minutesUntil: number;
}
