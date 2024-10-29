'use server';

import { ItemResponse } from '@/types/item-response.type';
import { api } from '@/utils/axios';

import { Trade, initialState } from './type';

export const getTradesAction = async (): Promise<ItemResponse<Trade>> => {
  try {
    const { data } = await api.get('/api/v1/trades');

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
