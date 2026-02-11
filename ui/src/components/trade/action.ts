'use server';

import { getTranslations } from 'next-intl/server';

import { CursorItem, PaginatedItem } from '@/interfaces/item.interface';
import { getClient } from '@/utils/api';

import { Trade, initialCursorState, initialState } from '../../interfaces/trade.interface';

export interface GetTradeParams {
  page?: number;
  perPage?: number;
  lastHours?: number;
}

export const getTradeAction = async (params?: GetTradeParams): Promise<PaginatedItem<Trade>> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/trades', { params: params ?? {} });

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

interface TradeCursorParams {
  cursor?: string;
  limit?: number;
  skip?: boolean;
  symbol?: string;
  type?: string;
  sortBy?: string;
  sortDirection?: string;
  startDate?: Date;
  endDate?: Date;
}

export const getTradeCursorAction = async (params: TradeCursorParams): Promise<CursorItem<Trade>> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/trades/cursor', {
      params,
    });

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    return {
      ...initialCursorState,
      success: false,
      message: t('error.fetch_failed', { error: String(error) }),
    };
  }
};
