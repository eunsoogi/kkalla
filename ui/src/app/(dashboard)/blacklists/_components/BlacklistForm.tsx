'use client';

import { useRouter } from 'next/navigation';
import React, { Suspense, useActionState } from 'react';

import { Icon } from '@iconify/react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Alert, Button, Label, Select, TextInput } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';

import { Category } from '@/enums/category.enum';
import { Blacklist } from '@/app/(dashboard)/blacklists/_types/blacklist.types';

import { createBlacklistAction, deleteBlacklistAction, getBlacklistAction, updateBlacklistAction } from '../_actions/blacklist.actions';

interface BlacklistFormProps {
  id?: string;
}

const BlacklistFormSkeleton = () => {
  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6 relative w-full min-h-full break-words'>
      <div className='space-y-6 animate-pulse'>
        <div className='h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4'></div>
        <div className='space-y-4'>
          <div>
            <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6 mb-2'></div>
            <div className='h-10 bg-gray-200 dark:bg-gray-700 rounded'></div>
          </div>
          <div>
            <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6 mb-2'></div>
            <div className='h-10 bg-gray-200 dark:bg-gray-700 rounded'></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const BlacklistFormContent: React.FC<BlacklistFormProps> = ({ id }) => {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { pending } = useFormStatus();

  const action = id ? updateBlacklistAction : createBlacklistAction;
  const [formState, formDispatch] = useActionState(action, {
    success: false,
    message: '',
  });

  const { data: blacklist } = useSuspenseQuery<Blacklist | null>({
    queryKey: ['blacklist', id],
    queryFn: () => (id ? getBlacklistAction(id) : null),
    initialData: null,
    refetchOnMount: 'always',
  });

  if (id && !blacklist) {
    return null;
  }

  const handleSubmit = async (formData: FormData) => {
    formDispatch(formData);

    if (formState.success) {
      queryClient.invalidateQueries({
        queryKey: ['blacklists'],
      });
      router.push('/blacklists');
      router.refresh();
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    const confirmDelete = window.confirm(t('blacklist.delete_confirm'));
    if (!confirmDelete) return;

    const formData = new FormData();
    formData.append('id', id);

    const result = await deleteBlacklistAction({ success: false }, formData);

    if (result.success) {
      router.push('/blacklists');
    } else {
      console.error(result.message);
    }
  };

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6 relative w-full min-h-full break-words'>
      {formState.message && (
        <Alert className='mb-6' color={formState.success ? 'success' : 'failure'}>
          {formState.message}
        </Alert>
      )}
      <div className='space-y-6'>
        <div className='flex justify-between items-center'>
          <h5 className='card-title text-dark dark:text-white'>{id ? t('blacklist.update') : t('blacklist.create')}</h5>
        </div>
        <form action={handleSubmit} className='flex flex-col gap-4'>
          {id && <input type='hidden' name='id' value={id} />}
          <div>
            <Label htmlFor='symbol' className='flex items-center gap-2 text-base'>
              <Icon icon='mdi:ticket' className='w-5 h-5' />
              {t('symbol')}
            </Label>
            <TextInput
              id='symbol'
              name='symbol'
              type='text'
              required
              className='mt-2'
              defaultValue={blacklist?.symbol || ''}
            />
          </div>
          <div>
            <Label htmlFor='category' className='flex items-center gap-2 text-base'>
              <Icon icon='mdi:category' className='w-5 h-5' />
              {t('category.label')}
            </Label>
            <Select id='category' name='category' required className='mt-2' defaultValue={blacklist?.category || ''}>
              <option value=''>{t('category.select')}</option>
              <option value={Category.COIN_MAJOR}>{t('category.coin.major')}</option>
              <option value={Category.COIN_MINOR}>{t('category.coin.minor')}</option>
              <option value={Category.NASDAQ}>{t('category.nasdaq')}</option>
            </Select>
          </div>
          <div className='flex justify-end'>
            <div className='flex items-center gap-4'>
              {id && (
                <Button color='failure' onClick={handleDelete}>
                  {t('delete')}
                </Button>
              )}
              <Button type='submit' color='primary' disabled={pending}>
                {t('save')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export const BlacklistForm = ({ id }: BlacklistFormProps) => {
  return (
    <Suspense fallback={<BlacklistFormSkeleton />}>
      <BlacklistFormContent id={id} />
    </Suspense>
  );
};
