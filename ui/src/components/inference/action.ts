'use server';

import { ItemResponse } from '@/types/item-response.type';
import { api } from '@/utils/api/axios';

import { Inference, initialState } from './type';

export const getInferencesAction = async (): Promise<ItemResponse<Inference>> => {
  try {
    const { data } = await api.get('/api/v1/inferences');

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
