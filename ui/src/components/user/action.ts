'use server';

import { getTranslations } from 'next-intl/server';

import { PaginatedItem } from '@/interfaces/item.interface';
import { Role } from '@/interfaces/role.interface';
import { User } from '@/interfaces/user.interface';
import { getClient } from '@/utils/api';

export interface UsersParams {
  page?: number;
  perPage?: number;
}

export interface UserState {
  success: boolean;
  message?: string;
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

export const getUserAction = async (id: string): Promise<User> => {
  const client = await getClient();

  try {
    const { data } = await client.get(`/api/v1/users/${id}`);
    return data;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw error;
  }
};

export const updateUserAction = async (_: UserState, formData: FormData): Promise<UserState> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const id = formData.get('id') as string;
    const roles = JSON.parse(formData.get('roles') as string) as Role[];

    await client.put(`/api/v1/users/${id}`, { roles });

    return {
      success: true,
      message: t('updated'),
    };
  } catch (error) {
    return {
      success: false,
      message: t('error.update_failed', { error: String(error) }),
    };
  }
};

export const getRolesAction = async (): Promise<Role[]> => {
  const client = await getClient();

  try {
    const { data } = await client.get('/api/v1/roles');
    return data;
  } catch (error) {
    console.error('Failed to fetch roles:', error);
    throw error;
  }
};
