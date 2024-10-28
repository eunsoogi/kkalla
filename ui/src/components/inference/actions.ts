'use server';

import { api } from '@/utils/api/axios';

import { InferenceResponse, initialState } from './state';

export const getInferencesAction = async (): Promise<InferenceResponse> => {
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
