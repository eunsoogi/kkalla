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

const isScheduleExecutionTask = (task: unknown): task is ScheduleExecutionTask => {
  return typeof task === 'string' && SCHEDULE_EXECUTION_TASKS.includes(task as ScheduleExecutionTask);
};

const isScheduleExecutionStatus = (status: string): status is ScheduleExecutionStatus => {
  return ['started', 'skipped_lock'].includes(status);
};

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

export const executeMarketSignalAction = async (): Promise<ScheduleActionState> => {
  return executeScheduleAction('/api/v1/schedules/execute/market-signal', 'marketSignal');
};

export const executeAllocationRecommendationWithExistingItemsAction = async (): Promise<ScheduleActionState> => {
  return executeScheduleAction(
    '/api/v1/schedules/execute/allocation-recommendation/existing',
    'allocationRecommendationExisting',
  );
};

export const executeAllocationRecommendationNewItemsAction = async (): Promise<ScheduleActionState> => {
  return executeScheduleAction('/api/v1/schedules/execute/allocation-recommendation/new', 'allocationRecommendationNew');
};

export const executeAllocationAuditAction = async (): Promise<ScheduleActionState> => {
  return executeScheduleAction('/api/v1/schedules/execute/allocation-audit', 'allocationAudit');
};

export const getScheduleExecutionPlansAction = async (): Promise<ScheduleExecutionPlanResponse[]> => {
  const client = await getClient();

  try {
    const { data } = await client.get<ScheduleExecutionPlanResponse[]>('/api/v1/schedules/execution-plans');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

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
