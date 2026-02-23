'use server';
import { getTranslations } from 'next-intl/server';

import { PaginatedItem } from '@/shared/types/pagination.types';
import { Permission } from '@/shared/types/permission.types';
import { Role } from '@/shared/types/role.types';
import { getClient } from '@/utils/api';

export interface RolesParams {
  page?: number;
  perPage?: number;
}

export interface RoleState {
  success: boolean;
  message?: string;
}

/**
 * Retrieves roles action for the dashboard UI flow.
 * @param params - Input values for the dashboard UI operation.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
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

/**
 * Retrieves role action for the dashboard UI flow.
 * @param id - Identifier for the target resource.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
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

/**
 * Builds role action used in the dashboard UI flow.
 * @param _ - Input value for .
 * @param formData - Input value for form data.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
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

/**
 * Handles role action in the dashboard UI workflow.
 * @param _ - Input value for .
 * @param formData - Input value for form data.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
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

/**
 * Handles delete role action in the dashboard UI workflow.
 * @param _ - Input value for .
 * @param formData - Input value for form data.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
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

/**
 * Retrieves permissions action for the dashboard UI flow.
 * @returns Processed collection for downstream workflow steps.
 */
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
