'use server';
import { Feargreed, FeargreedHistory } from '@/app/(dashboard)/_components/home/feargreed/_types/feargreed.types';
import { getClient } from '@/utils/api';

/**
 * Retrieves feargreed action for the dashboard UI flow.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export const getFeargreedAction = async (): Promise<Feargreed | null> => {
  const client = await getClient();

  try {
    const { data } = await client.get('/api/v1/feargreeds');
    return data;
  } catch {
    return null;
  }
};

/**
 * Retrieves feargreed history action for the dashboard UI flow.
 * @param limit - Input value for limit.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export const getFeargreedHistoryAction = async (limit: number = 30): Promise<FeargreedHistory | null> => {
  const client = await getClient();
  const url = new URL('/api/v1/feargreeds/history', client.defaults.baseURL);
  url.searchParams.set('limit', limit.toString());

  try {
    const { data } = await client.get(url.toString());
    return data;
  } catch {
    return null;
  }
};
