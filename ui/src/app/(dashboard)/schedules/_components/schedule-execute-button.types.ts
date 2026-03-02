import type { ScheduleActionState, ScheduleLockActionState } from '../_actions/schedule.actions';
import type {
  ScheduleExecutionPlanResponse,
  ScheduleExecutionTask,
  ScheduleLockStateResponse,
} from '../_types/schedule-execution.types';

export interface ScheduleExecuteButtonProps {
  type: ScheduleExecutionTask;
  isPending: boolean;
  isReleasePending: boolean;
  onExecute: () => void;
  onReleaseLock: () => void;
  result?: ScheduleActionState;
  lockState?: ScheduleLockStateResponse;
  lockResult?: ScheduleLockActionState;
  plan?: ScheduleExecutionPlanResponse;
  isPlanLoading: boolean;
  isLockLoading: boolean;
  highlightRunAt?: string;
  highlightRemainingText?: string;
}
