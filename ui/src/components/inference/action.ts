'use server';

import { Inference, initialCursorState, initialPaginatedState } from '@/interfaces/inference.interface';
import { CursorItem, PaginatedItem } from '@/interfaces/item.interface';
import { getClient } from '@/utils/api';

export interface InferenceParams {
  page?: number | null;
  mine?: boolean;
}

export const getInferenceAction = async (params: InferenceParams): Promise<PaginatedItem<Inference>> => {
  const client = await getClient();

  try {
    const { data } = await client.get('/api/v1/inferences', {
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
      message: String(error),
    };
  }
};

export interface InferenceCursorParams {
  cursor?: string;
  limit?: number;
  skip?: boolean;
  mine?: boolean;
}

export const getInferenceCursorAction = async (params: InferenceCursorParams): Promise<CursorItem<Inference>> => {
  const client = await getClient();

  try {
    const { data } = await client.get('/api/v1/inferences/cursor', {
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
      message: String(error),
    };
  }
};
