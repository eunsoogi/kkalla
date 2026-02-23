'use server';
import { getTranslations } from 'next-intl/server';

import { PaginatedItem } from '@/shared/types/pagination.types';
import { ProfitData } from '@/app/(dashboard)/_shared/profit/_types/profit.types';
import { ProfitResponse } from '@/app/(dashboard)/_shared/trades/trade.types';
import { getClient } from '@/utils/api';

export interface GetProfitListParams {
  page?: number;
  perPage?: number;
  email?: string;
}

/**
 * Retrieves my profit action for the dashboard UI flow.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export const getMyProfitAction = async (): Promise<ProfitResponse> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/profits/my');
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      message: t('error.fetch_failed', { error: String(error) }),
    };
  }
};

/**
 * Retrieves profits action for the dashboard UI flow.
 * @param params - Input values for the dashboard UI operation.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export async function getProfitsAction(params?: GetProfitListParams): Promise<PaginatedItem<ProfitData>> {
  const client = await getClient();
  const { data } = await client.get('/api/v1/profits', {
    params,
  });
  return data;
}
