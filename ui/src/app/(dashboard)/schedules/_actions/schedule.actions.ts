'use server';
import { getTranslations } from 'next-intl/server';

import {
  ScheduleExecutionPlanResponse,
  ScheduleExecutionResponse,
  ScheduleExecutionStatus,
  ScheduleExecutionTask,
  ScheduleLockReleaseResponse,
  ScheduleLockStateResponse,
} from '../_types/schedule-execution.types';
import { getClient } from '@/utils/api';

type ScheduleActionStatus = ScheduleExecutionStatus | 'failed';

export interface ScheduleActionState {
  task: ScheduleExecutionTask;
  status: ScheduleActionStatus;
  requestedAt: string;
  message: string;
}

export type ScheduleLockActionStatus = 'released' | 'already_unlocked' | 'failed';

export interface ScheduleLockActionState {
  task: ScheduleExecutionTask;
  status: ScheduleLockActionStatus;
  releasedAt: string;
  message: string;
  recoveredRunningCount?: number;
}

const SCHEDULE_EXECUTION_TASKS: ScheduleExecutionTask[] = [
  'marketSignal',
  'allocationRecommendationExisting',
  'allocationRecommendationNew',
  'allocationAudit',
];

/**
 * Checks schedule execution task in the dashboard UI context.
 * @param task - Task identifier to execute.
 * @returns Result produced by the dashboard UI flow.
 */
const isScheduleExecutionTask = (task: unknown): task is ScheduleExecutionTask => {
  return typeof task === 'string' && SCHEDULE_EXECUTION_TASKS.includes(task as ScheduleExecutionTask);
};

/**
 * Checks schedule execution status in the dashboard UI context.
 * @param status - Input value for status.
 * @returns Result produced by the dashboard UI flow.
 */
const isScheduleExecutionStatus = (status: string): status is ScheduleExecutionStatus => {
  return ['started', 'skipped_lock'].includes(status);
};

/**
 * Checks schedule lock state response in the dashboard UI context.
 * @param value - Input value for value.
 * @returns Result produced by the dashboard UI flow.
 */
const isScheduleLockStateResponse = (value: unknown): value is ScheduleLockStateResponse => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ScheduleLockStateResponse>;
  return (
    isScheduleExecutionTask(candidate.task) &&
    typeof candidate.locked === 'boolean' &&
    (typeof candidate.ttlMs === 'number' || candidate.ttlMs === null) &&
    typeof candidate.checkedAt === 'string'
  );
};

/**
 * Checks schedule lock release response in the dashboard UI context.
 * @param value - Input value for value.
 * @returns Result produced by the dashboard UI flow.
 */
const isScheduleLockReleaseResponse = (value: unknown): value is ScheduleLockReleaseResponse => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ScheduleLockReleaseResponse>;
  return (
    isScheduleExecutionTask(candidate.task) &&
    typeof candidate.released === 'boolean' &&
    typeof candidate.locked === 'boolean' &&
    typeof candidate.releasedAt === 'string' &&
    (candidate.recoveredRunningCount == null || typeof candidate.recoveredRunningCount === 'number')
  );
};

/**
 * Retrieves status message for the dashboard UI flow.
 * @param t - Input value for t.
 * @param status - Input value for status.
 * @returns Formatted string output for the operation.
 */
const getStatusMessage = (t: Awaited<ReturnType<typeof getTranslations>>, status: ScheduleActionStatus): string => {
  switch (status) {
    case 'started':
      return t('schedule.execute.status.started');
    case 'skipped_lock':
      return t('schedule.execute.status.skippedLock');
    default:
      return t('schedule.execute.status.failed');
  }
};

/**
 * Retrieves lock action message for the dashboard UI flow.
 * @param t - Input value for t.
 * @param status - Input value for status.
 * @returns Formatted string output for the operation.
 */
const getLockActionMessage = (t: Awaited<ReturnType<typeof getTranslations>>, status: ScheduleLockActionStatus): string => {
  switch (status) {
    case 'released':
      return t('schedule.execute.lock.releaseStatus.released');
    case 'already_unlocked':
      return t('schedule.execute.lock.releaseStatus.alreadyUnlocked');
    default:
      return t('schedule.execute.lock.releaseStatus.failed');
  }
};

/**
 * Runs schedule action in the dashboard UI workflow.
 * @param path - Input value for path.
 * @param task - Task identifier to execute.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
const executeScheduleAction = async (path: string, task: ScheduleExecutionTask): Promise<ScheduleActionState> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.post<ScheduleExecutionResponse>(path);

    if (!data || !isScheduleExecutionStatus(data.status)) {
      return {
        task,
        status: 'failed',
        requestedAt: new Date().toISOString(),
        message: getStatusMessage(t, 'failed'),
      };
    }

    return {
      task: data.task ?? task,
      status: data.status,
      requestedAt: data.requestedAt ?? new Date().toISOString(),
      message: getStatusMessage(t, data.status),
    };
  } catch {
    return {
      task,
      status: 'failed',
      requestedAt: new Date().toISOString(),
      message: getStatusMessage(t, 'failed'),
    };
  }
};

/**
 * Runs market signal action in the dashboard UI workflow.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export const executeMarketSignalAction = async (): Promise<ScheduleActionState> => {
  return executeScheduleAction('/api/v1/schedules/execute/market-signal', 'marketSignal');
};

/**
 * Runs allocation recommendation with existing items action in the dashboard UI workflow.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export const executeAllocationRecommendationWithExistingItemsAction = async (): Promise<ScheduleActionState> => {
  return executeScheduleAction(
    '/api/v1/schedules/execute/allocation-recommendation/existing',
    'allocationRecommendationExisting',
  );
};

/**
 * Runs allocation recommendation new items action in the dashboard UI workflow.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export const executeAllocationRecommendationNewItemsAction = async (): Promise<ScheduleActionState> => {
  return executeScheduleAction('/api/v1/schedules/execute/allocation-recommendation/new', 'allocationRecommendationNew');
};

/**
 * Runs allocation audit action in the dashboard UI workflow.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export const executeAllocationAuditAction = async (): Promise<ScheduleActionState> => {
  return executeScheduleAction('/api/v1/schedules/execute/allocation-audit', 'allocationAudit');
};

/**
 * Retrieves schedule execution plans action for the dashboard UI flow.
 * @returns Processed collection for downstream workflow steps.
 */
export const getScheduleExecutionPlansAction = async (): Promise<ScheduleExecutionPlanResponse[]> => {
  const client = await getClient();

  try {
    const { data } = await client.get<ScheduleExecutionPlanResponse[]>('/api/v1/schedules/execution-plans');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

/**
 * Retrieves schedule lock states action for the dashboard UI flow.
 * @returns Processed collection for downstream workflow steps.
 */
export const getScheduleLockStatesAction = async (): Promise<ScheduleLockStateResponse[]> => {
  const client = await getClient();

  try {
    const { data } = await client.get<unknown>('/api/v1/schedules/locks');
    if (!Array.isArray(data)) {
      return [];
    }

    return data.filter((item): item is ScheduleLockStateResponse => isScheduleLockStateResponse(item));
  } catch {
    return [];
  }
};

/**
 * Runs release schedule lock action in the dashboard UI workflow.
 * @param task - Task identifier to execute.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export const releaseScheduleLockAction = async (task: ScheduleExecutionTask): Promise<ScheduleLockActionState> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.post<unknown>(`/api/v1/schedules/locks/${task}/release`);

    if (!isScheduleLockReleaseResponse(data)) {
      return {
        task,
        status: 'failed',
        releasedAt: new Date().toISOString(),
        message: getLockActionMessage(t, 'failed'),
        recoveredRunningCount: undefined,
      };
    }

    const status: ScheduleLockActionStatus = data.released ? 'released' : data.locked ? 'failed' : 'already_unlocked';

    return {
      task: data.task,
      status,
      releasedAt: data.releasedAt,
      message: getLockActionMessage(t, status),
      recoveredRunningCount: data.recoveredRunningCount,
    };
  } catch {
    return {
      task,
      status: 'failed',
      releasedAt: new Date().toISOString(),
      message: getLockActionMessage(t, 'failed'),
      recoveredRunningCount: undefined,
    };
  }
};
