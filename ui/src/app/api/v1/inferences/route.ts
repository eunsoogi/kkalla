'use server';

import { Inference, initialPaginatedState } from '@/interfaces/inference.interface';
import { PaginatedItem } from '@/interfaces/item.interface';
import { getClient } from '@/utils/api';

export const GET = async (page?: number | null): Promise<PaginatedItem<Inference>> => {
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
