'use server';

import { getTranslations } from 'next-intl/server';

import { PaginatedItem } from '@/interfaces/item.interface';
import { getClient } from '@/utils/api';

import { ProfitResponse, Trade, initialState } from '../../interfaces/trade.interface';

export const getTradeAction = async (): Promise<PaginatedItem<Trade>> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/trades');

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    return {
      ...initialState,
      success: false,
      message: t('error.fetch_failed', { error: String(error) }),
    };
  }
};

export const getProfitAction = async (): Promise<ProfitResponse> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/trades/profit');
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
