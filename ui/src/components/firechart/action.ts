'use server';

import { getClient } from '@/utils/api';

export const getFirechartAction = async (): Promise<string | null> => {
  const client = await getClient();

  try {
    const { data } = await client.get('/api/v1/firechart');
    return data;
  } catch {
    return null;
  }
};
