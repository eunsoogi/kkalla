'use server';

import { getClient } from '@/utils/api';

import { State } from './state';

export const postApikeyAction = async (_: State, formData: FormData): Promise<State> => {
  const client = await getClient();

  try {
    await client.post('/api/v1/apikeys', formData);

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
