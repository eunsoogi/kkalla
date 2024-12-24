'use server';

import { getTranslations } from 'next-intl/server';

import { PaginatedItem } from '@/interfaces/item.interface';
import { ProfitData } from '@/interfaces/profit.interface';
import { ProfitResponse } from '@/interfaces/trade.interface';
import { getClient } from '@/utils/api';

export interface GetProfitListParams {
  page?: number;
  perPage?: number;
  email?: string;
}

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

export async function getProfitsAction(params?: GetProfitListParams): Promise<PaginatedItem<ProfitData>> {
  const client = await getClient();
  const { data } = await client.get('/api/v1/profits', {
    params,
  });
  return data;
}
