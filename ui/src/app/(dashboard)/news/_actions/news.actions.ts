'use server';
import { getTranslations } from 'next-intl/server';

import { CursorItem } from '@/shared/types/pagination.types';
import { News, initialCursorState } from '@/app/(dashboard)/_shared/news/news.types';
import { getClient } from '@/utils/api';

/**
 * Retrieves news action for the dashboard UI flow.
 * @param cursor - Input value for cursor.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
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
