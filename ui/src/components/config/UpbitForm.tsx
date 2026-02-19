'use client';

import React, { Suspense, useActionState } from 'react';

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Alert, Badge, Button, Label, TextInput } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';

import { ApikeyStatus } from '@/enums/apikey.enum';
import { initialState } from '@/interfaces/state.interface';

import { getUpbitStatusAction, postUpbitConfigAction } from './action';
import { STATUS_STYLES } from './style';

const badgeQueryKey = ['upbit', 'status'];

const UpbitStatusBadge: React.FC = () => {
  const t = useTranslations();

  const { data } = useSuspenseQuery<ApikeyStatus>({
    queryKey: badgeQueryKey,
    queryFn: getUpbitStatusAction,
    initialData: ApikeyStatus.UNKNOWN,
    refetchOnMount: 'always',
  });

  return <Badge className={STATUS_STYLES[data]}>{t(`status.${data}`)}</Badge>;
};

const UpbitStatusBadgeSkeleton: React.FC = () => {
  const t = useTranslations();

  return <Badge className={STATUS_STYLES.unknown}>{t('status.unknown')}</Badge>;
};

const UpbitForm: React.FC = () => {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [formState, formDispatch] = useActionState(postUpbitConfigAction, initialState);
  const { pending } = useFormStatus();

  const handleSubmit = async (payload: FormData) => {
    formDispatch(payload);
    queryClient.invalidateQueries({
      queryKey: badgeQueryKey,
    });
  };

  return (
    <>
      {formState.message && (
        <Alert className='mb-6' color={formState.success ? 'success' : 'failure'}>
          {formState.message}
        </Alert>
      )}
      <form action={handleSubmit}>
        <div className='flex flex-col items-start gap-2 text-left w-full'>
          <h5 className='card-title text-dark dark:text-white'>{t('upbit.register')}</h5>
          <Suspense fallback={<UpbitStatusBadgeSkeleton />}>
            <UpbitStatusBadge />
          </Suspense>
        </div>
        <div className='mt-6'>
          <div className='grid grid-cols-12 gap-y-6 lg:gap-x-6'>
            <div className='lg:col-span-6 col-span-12'>
              <div className='flex flex-col gap-4'>
                <div>
                  <div className='mb-2 block'>
                    <Label htmlFor='upbitAccessKey'>액세스 키</Label>
                  </div>
                  <TextInput
                    id='upbitAccessKey'
                    name='accessKey'
                    type='text'
                    required
                    autoComplete='off'
                    className='form-control form-rounded-xl'
                  />
                  <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>{t('upbit.access_key_help')}</p>
                </div>
              </div>
            </div>
            <div className='lg:col-span-6 col-span-12'>
              <div className='flex flex-col gap-4'>
                <div>
                  <div className='mb-2 block'>
                    <Label htmlFor='upbitSecretKey'>비밀 키</Label>
                  </div>
                  <TextInput
                    id='upbitSecretKey'
                    name='secretKey'
                    type='password'
                    required
                    autoComplete='off'
                    className='form-control form-rounded-xl'
                  />
                  <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>{t('upbit.secret_key_help')}</p>
                </div>
              </div>
            </div>
            <div className='flex col-span-12'>
              <Button type='submit' color={'primary'} disabled={pending}>
                {t('save')}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
};

export default UpbitForm;
