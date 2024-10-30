'use server';

import { ItemResponse } from '@/types/item-response.type';
import { getClient } from '@/utils/api';

import { Inference, initialState } from './type';

export const getInferencesAction = async (): Promise<ItemResponse<Inference>> => {
  const client = await getClient();

  try {
    const { data } = await client.get('/api/v1/inferences');

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
