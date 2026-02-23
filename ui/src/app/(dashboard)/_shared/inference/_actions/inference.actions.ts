'use server';

import { getTranslations } from 'next-intl/server';

import {
  AllocationRecommendation,
  MarketSignal,
  initialCursorState,
  initialPaginatedState,
} from '@/app/(dashboard)/_shared/inference/_types/inference.types';
import { CursorItem, PaginatedItem } from '@/shared/types/pagination.types';
import { getClient } from '@/utils/api';

export interface InferenceParams {
  page?: number | null;
  mine?: boolean;
  symbol?: string;
  category?: string;
}

export const getMarketSignalsAction = async (
  params: InferenceParams,
): Promise<PaginatedItem<MarketSignal>> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/market-intelligence/market-signals', {
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

export const getMarketSignalsCursorAction = async (
  params: InferenceCursorParams,
): Promise<CursorItem<MarketSignal>> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/market-intelligence/market-signals/cursor', {
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

export const getAllocationRecommendationsAction = async (
  params: InferenceParams,
): Promise<PaginatedItem<AllocationRecommendation>> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/allocation/allocation-recommendations', {
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

export const getAllocationRecommendationsCursorAction = async (
  params: InferenceCursorParams,
): Promise<CursorItem<AllocationRecommendation>> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/allocation/allocation-recommendations/cursor', {
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
