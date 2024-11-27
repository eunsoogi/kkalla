'use server';

import { PaginatedItem } from '@/interfaces/item.interface';
import { User } from '@/interfaces/user.interface';
import { getClient } from '@/utils/api';

export interface UsersParams {
  page?: number;
  perPage?: number;
}

export const getUsersAction = async (params: UsersParams): Promise<PaginatedItem<User>> => {
  const client = await getClient();

  try {
    const { data } = await client.get('/api/v1/users', {
      params,
    });
    return data;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
};
