'use server';
import { getTranslations } from 'next-intl/server';

import { CursorItem, PaginatedItem } from '@/shared/types/pagination.types';
import { getClient } from '@/utils/api';

import { Trade, initialCursorState, initialState } from '@/app/(dashboard)/_shared/trades/trade.types';

export interface GetTradeParams {
  page?: number;
  perPage?: number;
  lastHours?: number;
}

/**
 * Retrieves trade action for the dashboard UI flow.
 * @param params - Input values for the dashboard UI operation.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export const getTradeAction = async (params?: GetTradeParams): Promise<PaginatedItem<Trade>> => {
  const client = await getClient();
  const t = await getTranslations();

  // Only forward known API params (e.g. when used as queryFn reference, react-query passes QueryFunctionContext)
  const queryParams: GetTradeParams = {};
  if (params != null && typeof params === 'object') {
    if (typeof params.page === 'number') queryParams.page = params.page;
    if (typeof params.perPage === 'number') queryParams.perPage = params.perPage;
    if (typeof params.lastHours === 'number') queryParams.lastHours = params.lastHours;
  }

  try {
    const { data } = await client.get('/api/v1/trades', { params: queryParams });

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

/**
 * Retrieves trade cursor action for the dashboard UI flow.
 * @param params - Input values for the dashboard UI operation.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
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
