'use server';

import { Decision, initialPaginatedState } from '@/interfaces/decision.interface';
import { PaginatedItem } from '@/interfaces/item.interface';
import { getClient } from '@/utils/api';

export const getDecisionAction = async (id: string): Promise<Decision | null> => {
  const client = await getClient();

  try {
    const { data } = await client.get(`/api/v1/decisions/${id}`);
    return data;
  } catch (error) {
    console.error(error);
    return null;
  }
};

export interface DecisionParams {
  page?: number | null;
  mine?: boolean;
}

export const getDecisionsAction = async (params: DecisionParams): Promise<PaginatedItem<Decision>> => {
  const client = await getClient();

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
      message: String(error),
    };
  }
};
