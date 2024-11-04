'use server';

import { CursorItem } from '@/interfaces/item.interface';
import { News, initialCursorState } from '@/interfaces/news.interface';
import { getClient } from '@/utils/api';

export const getNewsAction = async (cursor?: string): Promise<CursorItem<News>> => {
  const client = await getClient();

  try {
    const { data } = await client.get('/api/v1/news/cursor', {
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
