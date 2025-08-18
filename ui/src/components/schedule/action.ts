'use server';

import { getTranslations } from 'next-intl/server';

import { getClient } from '@/utils/api';

export interface ScheduleActionState {
  success: boolean;
  message?: string;
}

export const executeExistItemsAction = async (): Promise<ScheduleActionState> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    client.post('/api/v1/schedules/execute/exist-items');

    return {
      success: true,
      message: t('schedule.execute.existItems.success'),
    };
  } catch {
    return {
      success: false,
      message: t('schedule.execute.existItems.error'),
    };
  }
};

export const executeNewItemsAction = async (): Promise<ScheduleActionState> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    client.post('/api/v1/schedules/execute/new-items');

    return {
      success: true,
      message: t('schedule.execute.newItems.success'),
    };
  } catch {
    return {
      success: false,
      message: t('schedule.execute.newItems.error'),
    };
  }
};
