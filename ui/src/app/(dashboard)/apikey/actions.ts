'use server';

import { api } from '@/utils/axios';

import { State } from './state';

export const postApikeyAction = async (_: State, formData: FormData): Promise<State> => {
  try {
    await api.post('/api/v1/apikey', formData);
    return {
      success: true,
      message: '업데이트했습니다.',
    };
  } catch (error) {
    return {
      success: false,
      message: String(error),
    };
  }
};
