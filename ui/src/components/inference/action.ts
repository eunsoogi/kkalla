'use server';

import { Inference, initialCursorState, initialPaginatedState } from '@/interfaces/inference.interface';
import { CursorItem, PaginatedItem } from '@/interfaces/item.interface';
import { getClient } from '@/utils/api';

export const getInferenceAction = async (page?: number | null): Promise<PaginatedItem<Inference>> => {
  const client = await getClient();

  try {
    const { data } = await client.get('/api/v1/inferences', {
      params: { page },
    });

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    return {
      ...initialPaginatedState,
      success: false,
      message: String(error),
    };
  }
};

export const getInferenceCursorAction = async (cursor?: string): Promise<CursorItem<Inference>> => {
  const client = await getClient();

  try {
    const { data } = await client.get('/api/v1/inferences/cursor', {
      params: { cursor },
    });

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    return {
      ...initialCursorState,
      success: false,
      message: String(error),
    };
  }
};
