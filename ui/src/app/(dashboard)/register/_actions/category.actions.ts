'use server';

import { getTranslations } from 'next-intl/server';

import { Category } from '@/app/(dashboard)/register/_types/category.types';
import { getClient } from '@/utils/api';

export interface CategoryState {
  success: boolean;
  message?: string;
}

export const getCategoriesAction = async (): Promise<Category[]> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get('/api/v1/categories');
    return data;
  } catch (error) {
    console.error(t('error.fetch_failed'), error);
    throw error;
  }
};

export const getCategoryAction = async (id: string): Promise<Category> => {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const { data } = await client.get(`/api/v1/categories/${id}`);
    return data;
  } catch (error) {
    console.error(t('error.fetch_failed'), error);
    throw error;
  }
};

export async function createCategoryAction(_: CategoryState, formData: FormData): Promise<CategoryState> {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const category = formData.get('category') as string;

    await client.post('/api/v1/categories', {
      category,
    });

    return {
      success: true,
      message: t('category.create_success'),
    };
  } catch (error) {
    console.error(t('error.create_failed'), error);
    return {
      success: false,
      message: t('error.create_failed'),
    };
  }
}

export async function updateCategoryAction(_: CategoryState, formData: FormData): Promise<CategoryState> {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const category = formData.get('category') as string;
    const enabled = formData.get('enabled') === 'true';

    await client.put('/api/v1/categories', {
      category,
      enabled,
    });

    return {
      success: true,
      message: t('category.update_success'),
    };
  } catch (error) {
    console.error(t('error.update_failed'), error);
    return {
      success: false,
      message: t('error.update_failed'),
    };
  }
}

export async function deleteCategoryAction(_: CategoryState, formData: FormData): Promise<CategoryState> {
  const client = await getClient();
  const t = await getTranslations();

  try {
    const category = formData.get('category') as string;
    await client.delete('/api/v1/categories', {
      data: { category },
    });

    return {
      success: true,
      message: t('category.delete_success'),
    };
  } catch (error) {
    console.error(t('error.delete_failed'), error);
    return {
      success: false,
      message: t('error.delete_failed'),
    };
  }
}
