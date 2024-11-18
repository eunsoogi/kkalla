'use server';

import { Feargreed } from '@/interfaces/feargreed.interface';
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
