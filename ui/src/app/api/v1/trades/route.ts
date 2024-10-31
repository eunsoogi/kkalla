'use server';

import { PaginatedItem } from '@/interfaces/item.interface';
import { getClient } from '@/utils/api';

import { Trade, initialState } from '../../../../interfaces/trade.interface';

export const GET = async (): Promise<PaginatedItem<Trade>> => {
  const client = await getClient();

  try {
    const { data } = await client.get('/api/v1/trades');

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    return {
      ...initialState,
      success: false,
      message: String(error),
    };
  }
};
