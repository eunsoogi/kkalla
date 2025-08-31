'use server';

import { getTranslations } from 'next-intl/server';

import { getClient } from '@/utils/api';

export interface ScheduleActionState {
  success: boolean;
  message?: string;
}

export const executeMarketRecommendationAction = async (): Promise<ScheduleActionState> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    await client.post('/api/v1/schedules/execute/market-recommendation');

    return {
      success: true,
      message: t('schedule.execute.marketRecommendation.success'),
    };
  } catch {
    return {
      success: false,
      message: t('schedule.execute.marketRecommendation.error'),
    };
  }
};

export const executeBalanceRecommendationWithExistingItemsAction = async (): Promise<ScheduleActionState> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    await client.post('/api/v1/schedules/execute/balance-recommendation/existing');

    return {
      success: true,
      message: t('schedule.execute.balanceRecommendationExisting.success'),
    };
  } catch {
    return {
      success: false,
      message: t('schedule.execute.balanceRecommendationExisting.error'),
    };
  }
};

export const executebalanceRecommendationNewItemsAction = async (): Promise<ScheduleActionState> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    await client.post('/api/v1/schedules/execute/balance-recommendation/new');

    return {
      success: true,
      message: t('schedule.execute.balanceRecommendationNew.success'),
    };
  } catch {
    return {
      success: false,
      message: t('schedule.execute.balanceRecommendationNew.error'),
    };
  }
};
