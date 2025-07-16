'use server';

import { Feargreed, FeargreedHistory } from '@/interfaces/feargreed.interface';
import { getClient } from '@/utils/api';

export const getFeargreedAction = async (): Promise<Feargreed | null> => {
  const client = await getClient();

  try {
    const { data } = await client.get('/api/v1/feargreeds');
    return data;
  } catch {
    return null;
  }
};

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

