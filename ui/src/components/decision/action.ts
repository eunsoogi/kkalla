'use server';

import { getTranslations } from 'next-intl/server';

import { Decision, initialPaginatedState } from '@/interfaces/decision.interface';
import { PaginatedItem } from '@/interfaces/item.interface';
import { getClient } from '@/utils/api';

export const getDecisionAction = async (id: string): Promise<Decision | null> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get(`/api/v1/decisions/${id}`);
    return data;
  } catch (error) {
    console.error(t('error.fetch_failed', { error: String(error) }));
    return null;
  }
};

export interface DecisionParams {
  page?: number | null;
  mine?: boolean;
}

export const getDecisionsAction = async (params: DecisionParams): Promise<PaginatedItem<Decision>> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/decisions', {
      params,
    });

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    return {
      ...initialPaginatedState,
      success: false,
      message: t('error.fetch_failed', { error: String(error) }),
    };
  }
};
