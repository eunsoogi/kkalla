'use server';

import { getTranslations } from 'next-intl/server';

import {
  BalanceRecommendation,
  MarketRecommendation,
  initialCursorState,
  initialPaginatedState,
} from '@/interfaces/inference.interface';
import { CursorItem, PaginatedItem } from '@/interfaces/item.interface';
import { getClient } from '@/utils/api';

export interface InferenceParams {
  page?: number | null;
  mine?: boolean;
  symbol?: string;
  category?: string;
}

export const getMarketRecommendationsAction = async (
  params: InferenceParams,
): Promise<PaginatedItem<MarketRecommendation>> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/inferences/market-recommendations', {
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

interface InferenceCursorParams {
  cursor?: string;
  limit?: number;
  skip?: boolean;
  mine?: boolean;
  symbol?: string;
  category?: string;
  sortBy?: string;
  sortDirection?: string;
  startDate?: Date;
  endDate?: Date;
}

export const getMarketRecommendationsCursorAction = async (
  params: InferenceCursorParams,
): Promise<CursorItem<MarketRecommendation>> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/inferences/market-recommendations/cursor', {
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

export const getBalanceRecommendationsAction = async (
  params: InferenceParams,
): Promise<PaginatedItem<BalanceRecommendation>> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/inferences/balance-recommendations', {
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

export const getBalanceRecommendationsCursorAction = async (
  params: InferenceCursorParams,
): Promise<CursorItem<BalanceRecommendation>> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/inferences/balance-recommendations/cursor', {
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
