'use server';

import { getTranslations } from 'next-intl/server';

import { News } from '@/interfaces/news.interface';
import { getClient } from '@/utils/api';

import type { HoldingWithDailyChange, MarketReportWithChange } from '@/interfaces/dashboard.interface';

export const getLatestMarketReportsAction = async (
  limit = 10,
): Promise<{ success: boolean; message?: string; items?: MarketReportWithChange[] }> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get<MarketReportWithChange[]>('/api/v1/market-research/latest', {
      params: { limit },
    });
    return { success: true, items: Array.isArray(data) ? data : [] };
  } catch (error) {
    return { success: false, message: t('error.fetch_failed', { error: String(error) }), items: [] };
  }
};

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
