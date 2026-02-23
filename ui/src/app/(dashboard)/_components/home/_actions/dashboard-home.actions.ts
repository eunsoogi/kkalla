'use server';
import { getTranslations } from 'next-intl/server';

import { News } from '@/app/(dashboard)/_shared/news/news.types';
import { getClient } from '@/utils/api';

import type { HoldingWithDailyChange, MarketReportWithChange } from '@/app/(dashboard)/_components/home/_types/dashboard-summary.types';

/**
 * Retrieves latest market reports action for the dashboard UI flow.
 * @param limit - Input value for limit.
 * @returns Boolean flag that indicates whether the condition is satisfied.
 */
export const getLatestMarketReportsAction = async (
  limit = 10,
): Promise<{ success: boolean; message?: string; items?: MarketReportWithChange[] }> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get<MarketReportWithChange[]>('/api/v1/market-intelligence/latest', {
      params: { limit },
    });
    return { success: true, items: Array.isArray(data) ? data : [] };
  } catch (error) {
    return { success: false, message: t('error.fetch_failed', { error: String(error) }), items: [] };
  }
};

/**
 * Retrieves holdings action for the dashboard UI flow.
 * @returns Boolean flag that indicates whether the condition is satisfied.
 */
export const getHoldingsAction = async (): Promise<{
  success: boolean;
  message?: string;
  items?: HoldingWithDailyChange[];
}> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get<HoldingWithDailyChange[]>('/api/v1/holdings');
    return { success: true, items: Array.isArray(data) ? data : [] };
  } catch (error) {
    return { success: false, message: t('error.fetch_failed', { error: String(error) }), items: [] };
  }
};

/**
 * Retrieves dashboard news action for the dashboard UI flow.
 * @param limit - Input value for limit.
 * @returns Boolean flag that indicates whether the condition is satisfied.
 */
export const getDashboardNewsAction = async (
  limit = 20,
): Promise<{ success: boolean; message?: string; items?: News[] }> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get<News[]>('/api/v1/news/dashboard', {
      params: { limit },
    });
    return { success: true, items: Array.isArray(data) ? data : [] };
  } catch (error) {
    return { success: false, message: t('error.fetch_failed', { error: String(error) }), items: [] };
  }
};
