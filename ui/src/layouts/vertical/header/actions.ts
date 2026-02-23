import { CursorItem } from '@/shared/types/pagination.types';
import { Notify, initialCursorState } from '@/layouts/vertical/header/_types/notify.types';

/**
 * Retrieves notify cursor action for the dashboard header flow.
 * @param cursor - Input value for cursor.
 * @returns Asynchronous result produced by the dashboard header flow.
 */
export const getNotifyCursorAction = async (cursor?: string): Promise<CursorItem<Notify>> => {
  const params = new URLSearchParams();
  if (cursor) {
    params.set('cursor', cursor);
  }
  const query = params.toString();

  try {
    const response = await fetch(`/api/dashboard/notify/cursor${query ? `?${query}` : ''}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch notifications: ${response.status}`);
    }
    const data = await response.json();

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
