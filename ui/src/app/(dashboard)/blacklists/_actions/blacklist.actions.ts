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
