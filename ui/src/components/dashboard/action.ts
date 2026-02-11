'use server';

import { getTranslations } from 'next-intl/server';

import { PaginatedItem } from '@/interfaces/item.interface';
import { News } from '@/interfaces/news.interface';
import { getClient } from '@/utils/api';

import type { HoldingWithDailyChange, MarketReportWithChange, NotifyLogItem } from '@/interfaces/dashboard.interface';

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

export const getNotifyLogAction = async (
  page = 1,
  perPage = 20,
): Promise<PaginatedItem<NotifyLogItem>> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get<PaginatedItem<NotifyLogItem>>('/api/v1/notify/log', {
      params: { page, perPage },
    });
    // Axios 응답의 data 자체가 PaginatedItem<NotifyLogItem> 형태이므로 그대로 반환
    // (success 필드는 서버 응답에 이미 포함되어 있어 중복 지정하지 않는다)
    return data;
  } catch (error) {
    return {
      success: false,
      message: t('error.fetch_failed', { error: String(error) }),
      items: [],
      total: 0,
      page: 1,
      totalPages: 0,
    };
  }
};
