'use client';

import Link from 'next/link';
import React, { Suspense, useActionState } from 'react';

import { Icon } from '@iconify/react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Alert, Badge, Button, Label, TextInput, Tooltip } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';

import { ApikeyStatus } from '@/enums/apikey.enum';
import { initialState } from '@/interfaces/state.interface';

import { getOpenaiStatusAction, postOpenaiConfigAction } from './action';
import { STATUS_STYLES } from './style';

const badgeQueryKey = ['openai', 'status'];

const OpenaiStatusBadge: React.FC = () => {
  const t = useTranslations();

  const { data } = useSuspenseQuery<ApikeyStatus>({
    queryKey: badgeQueryKey,
    queryFn: getOpenaiStatusAction,
    initialData: ApikeyStatus.UNKNOWN,
    staleTime: 0,
  });

  return <Badge className={STATUS_STYLES[data]}>{t(`status.${data}`)}</Badge>;
};

const OpenaiStatusBadgeSkeleton: React.FC = () => {
  const t = useTranslations();

  return <Badge className={STATUS_STYLES.unknown}>{t('status.unknown')}</Badge>;
};

const OpenaiForm: React.FC = () => {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [formState, formDispatch] = useActionState(postOpenaiConfigAction, initialState);
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
        <div className='flex flex-column items-center gap-2'>
          <h5 className='card-title text-dark dark:text-white'>{t('openai.title')}</h5>
          <Tooltip content={t('openai.tooltip')}>
            <Link href='https://platform.openai.com/docs/quickstart' target='_blank'>
              <Icon icon='solar:info-circle-outline' height='1.125rem' className='text-dark dark:text-white' />
            </Link>
          </Tooltip>
          <Suspense fallback={<OpenaiStatusBadgeSkeleton />}>
            <OpenaiStatusBadge />
          </Suspense>
        </div>
        <div className='border-l-4 border-gray-300 dark:border-gray-500 mt-6 pl-6'>{t('openai.api.description')}</div>
        <div className='mt-6'>
          <div className='grid grid-cols-12 gap-y-30 lg:gap-x-30'>
            <div className='lg:col-span-6 col-span-12'>
              <div className='flex flex-col gap-4'>
                <div>
                  <div className='mb-2 block'>
                    <Label htmlFor='openaiSecretKey' value='비밀 키' />
                  </div>
                  <TextInput
                    id='openaiSecretKey'
                    name='secretKey'
                    type='text'
                    required
                    className='form-control form-rounded-xl'
                  />
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

export default OpenaiForm;
