'use server';
import { getTranslations } from 'next-intl/server';

import { PaginatedItem } from '@/shared/types/pagination.types';
import { Role } from '@/shared/types/role.types';
import { User } from '@/app/(dashboard)/users/_types/user.types';
import { getClient } from '@/utils/api';

export interface UsersParams {
  page?: number;
  perPage?: number;
}

export interface UserState {
  success: boolean;
  message?: string;
}

/**
 * Retrieves users action for the dashboard UI flow.
 * @param params - Input values for the dashboard UI operation.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
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

/**
 * Retrieves user action for the dashboard UI flow.
 * @param id - Identifier for the target resource.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
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

/**
 * Handles user action in the dashboard UI workflow.
 * @param _ - Input value for .
 * @param formData - Input value for form data.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
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

/**
 * Retrieves roles action for the dashboard UI flow.
 * @returns Processed collection for downstream workflow steps.
 */
export const getRolesAction = async (): Promise<Role[]> => {
  const client = await getClient();

  try {
    const { data } = await client.get('/api/v1/roles/all');
    return data;
  } catch (error) {
    console.error('Failed to fetch roles:', error);
    throw error;
  }
};
