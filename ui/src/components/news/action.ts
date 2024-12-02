'use server';

import { getTranslations } from 'next-intl/server';

import { CursorItem } from '@/interfaces/item.interface';
import { News, initialCursorState } from '@/interfaces/news.interface';
import { getClient } from '@/utils/api';

export const getNewsAction = async (cursor?: string): Promise<CursorItem<News>> => {
  const client = await getClient();
  const t = await getTranslations();

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
      message: t('error.fetch_failed', { error: String(error) }),
    };
  }
};
