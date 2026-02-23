'use server';
import { getTranslations } from 'next-intl/server';

import { Blacklist } from '@/app/(dashboard)/blacklists/_types/blacklist.types';
import { PaginatedItem } from '@/shared/types/pagination.types';
import { getClient } from '@/utils/api';

export interface BlacklistsParams {
  page?: number;
  perPage?: number;
}

export interface BlacklistState {
  success: boolean;
  message?: string;
}

/**
 * Retrieves blacklists action for the dashboard UI flow.
 * @param params - Input values for the dashboard UI operation.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export const getBlacklistsAction = async (params: BlacklistsParams): Promise<PaginatedItem<Blacklist>> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/blacklists', {
      params,
    });
    return data;
  } catch (error) {
    console.error(t('error.fetch_failed'), error);
    throw error;
  }
};

/**
 * Retrieves blacklist action for the dashboard UI flow.
 * @param id - Identifier for the target resource.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export const getBlacklistAction = async (id: string): Promise<Blacklist> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get(`/api/v1/blacklists/${id}`);
    return data;
  } catch (error) {
    console.error(t('error.fetch_failed'), error);
    throw error;
  }
};

/**
 * Builds blacklist action used in the dashboard UI flow.
 * @param _ - Input value for .
 * @param formData - Input value for form data.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export async function createBlacklistAction(_: BlacklistState, formData: FormData): Promise<BlacklistState> {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const symbol = formData.get('symbol') as string;
    const category = formData.get('category') as string;

    const payload = {
      symbol,
      category,
    };

    await client.post('/api/v1/blacklists', payload);

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
 * Handles blacklist action in the dashboard UI workflow.
 * @param _ - Input value for .
 * @param formData - Input value for form data.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export async function updateBlacklistAction(_: BlacklistState, formData: FormData): Promise<BlacklistState> {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const id = formData.get('id') as string;
    const symbol = formData.get('symbol') as string;
    const category = formData.get('category') as string;

    const payload = {
      symbol,
      category,
    };

    await client.patch(`/api/v1/blacklists/${id}`, payload);

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
 * Handles delete blacklist action in the dashboard UI workflow.
 * @param _ - Input value for .
 * @param formData - Input value for form data.
 * @returns Asynchronous result produced by the dashboard UI flow.
 */
export async function deleteBlacklistAction(_: BlacklistState, formData: FormData): Promise<BlacklistState> {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const id = formData.get('id') as string;
    await client.delete(`/api/v1/blacklists/${id}`);

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
