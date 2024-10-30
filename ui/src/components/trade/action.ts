'use server';

import { ItemResponse } from '@/types/item-response.type';
import { getClient } from '@/utils/api';

import { Trade, initialState } from './type';

export const getTradesAction = async (): Promise<ItemResponse<Trade>> => {
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
