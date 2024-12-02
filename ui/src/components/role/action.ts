'use server';

import { getTranslations } from 'next-intl/server';

import { PaginatedItem } from '@/interfaces/item.interface';
import { Permission } from '@/interfaces/permission.interface';
import { Role } from '@/interfaces/role.interface';
import { getClient } from '@/utils/api';

export interface RolesParams {
  page?: number;
  perPage?: number;
}

export interface RoleState {
  success: boolean;
  message?: string;
}

export const getRolesAction = async (params: RolesParams): Promise<PaginatedItem<Role>> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/roles', {
      params,
    });
    return data;
  } catch (error) {
    console.error(t('error.fetch_failed'), error);
    throw error;
  }
};

export const getRoleAction = async (id: string): Promise<Role> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get(`/api/v1/roles/${id}`);
    return data;
  } catch (error) {
    console.error(t('error.fetch_failed'), error);
    throw error;
  }
};

export async function createRoleAction(_: RoleState, formData: FormData): Promise<RoleState> {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const permissions = JSON.parse(formData.get('permissions') as string);

    const payload = {
      name,
      description,
      permissions,
    };

    await client.post('/api/v1/roles', payload);

    return {
      success: true,
      message: t('created'),
    };
  } catch (error) {
    return {
      success: false,
      message: t('error.create_failed', { error: String(error) }),
    };
  }
}

export async function updateRoleAction(_: RoleState, formData: FormData): Promise<RoleState> {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const permissions = JSON.parse(formData.get('permissions') as string);

    const payload = {
      name,
      description,
      permissions,
    };

    await client.put(`/api/v1/roles/${id}`, payload);

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
}

export async function deleteRoleAction(_: RoleState, formData: FormData): Promise<RoleState> {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const id = formData.get('id') as string;

    await client.delete(`/api/v1/roles/${id}`);

    return {
      success: true,
      message: t('deleted'),
    };
  } catch (error) {
    return {
      success: false,
      message: t('error.delete_failed', { error: String(error) }),
    };
  }
}

export const getPermissionsAction = async (): Promise<Permission[]> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/permissions');
    return data;
  } catch (error) {
    console.error(t('error.fetch_failed'), error);
    throw error;
  }
};
