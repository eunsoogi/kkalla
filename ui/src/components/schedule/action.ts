'use server';

import { getTranslations } from 'next-intl/server';

import {
  ScheduleExecutionPlanResponse,
  ScheduleExecutionResponse,
  ScheduleExecutionStatus,
  ScheduleExecutionTask,
} from '@/interfaces/schedule-execution.interface';
import { getClient } from '@/utils/api';

type ScheduleActionStatus = ScheduleExecutionStatus | 'failed';

export interface ScheduleActionState {
  task: ScheduleExecutionTask;
  status: ScheduleActionStatus;
  requestedAt: string;
  message: string;
}

const isScheduleExecutionStatus = (status: string): status is ScheduleExecutionStatus => {
  return ['started', 'skipped_lock'].includes(status);
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

export const executeMarketRecommendationAction = async (): Promise<ScheduleActionState> => {
  return executeScheduleAction('/api/v1/schedules/execute/market-recommendation', 'marketRecommendation');
};

export const executeBalanceRecommendationWithExistingItemsAction = async (): Promise<ScheduleActionState> => {
  return executeScheduleAction(
    '/api/v1/schedules/execute/balance-recommendation/existing',
    'balanceRecommendationExisting',
  );
};

export const executebalanceRecommendationNewItemsAction = async (): Promise<ScheduleActionState> => {
  return executeScheduleAction('/api/v1/schedules/execute/balance-recommendation/new', 'balanceRecommendationNew');
};

export const executeReportValidationAction = async (): Promise<ScheduleActionState> => {
  return executeScheduleAction('/api/v1/schedules/execute/report-validation', 'reportValidation');
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
