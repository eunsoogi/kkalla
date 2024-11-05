'use server';

import { ApikeyStatus, ApikeyTypes } from '@/enums/apikey.enum';
import { Schedule, initialState } from '@/interfaces/schedule.interface';
import { State } from '@/interfaces/state.interface';
import { getClient } from '@/utils/api';

export const getScheduleAction = async (): Promise<Schedule> => {
  const client = await getClient();

  try {
    const { data } = await client.get('/api/v1/schedules');
    return data;
  } catch {
    return initialState;
  }
};

export const postScheduleAction = async (schedule: Schedule): Promise<Schedule> => {
  const client = await getClient();

  try {
    const { data } = await client.post('/api/v1/schedules', schedule);
    return data;
  } catch {
    return initialState;
  }
};

export const getApikeyAction = async (type: ApikeyTypes): Promise<ApikeyStatus> => {
  const client = await getClient();

  try {
    const { data } = await client.get('/api/v1/apikeys', {
      params: {
        type,
      },
    });
    return data;
  } catch {
    return ApikeyStatus.UNKNOWN;
  }
};

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
