'use server';

import { Inference, initialCursorState } from '@/interfaces/inference.interface';
import { CursorItem } from '@/interfaces/item.interface';
import { getClient } from '@/utils/api';

export const GET = async (cursor?: string): Promise<CursorItem<Inference>> => {
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
