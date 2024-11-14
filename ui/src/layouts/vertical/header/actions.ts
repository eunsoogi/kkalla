'use server';

import { CursorItem } from '@/interfaces/item.interface';
import { Notify, initialCursorState } from '@/interfaces/notify.interface';
import { getClient } from '@/utils/api';

export const getNotifyCursorAction = async (cursor?: string): Promise<CursorItem<Notify>> => {
  const client = await getClient();

  try {
    const { data } = await client.get('/api/v1/notify/cursor', {
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
