'use client';

import React, { Suspense, useTransition } from 'react';

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ToggleSwitch } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { Schedule, initialState } from '@/interfaces/schedule.interface';

import { getScheduleAction, postScheduleAction } from './action';

const ScheduleToggleSwitch: React.FC = () => {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const queryKey = ['schedule'];

  const { data } = useSuspenseQuery<Schedule>({
    queryKey: queryKey,
    queryFn: () => getScheduleAction(),
    initialData: initialState,
    refetchOnMount: 'always',
  });

  const handleToggle = async (checked: boolean) => {
    startTransition(async () => {
      await postScheduleAction({ enabled: checked });
      queryClient.invalidateQueries({ queryKey });
    });
  };

  return <ToggleSwitch checked={data.enabled} onChange={handleToggle} disabled={isPending} label={t('activate')} />;
};

const ScheduleToggleSwitchSkeleton: React.FC = () => {
  const t = useTranslations();

  return <ToggleSwitch checked={false} onChange={() => null} label={t('activate')} />;
};

const ScheduleForm: React.FC = () => {
  const t = useTranslations();

  return (
    <>
      <div className='flex flex-column items-center gap-2'>
        <h5 className='card-title text-dark dark:text-white'>{t('service.title')}</h5>
      </div>
      <div className='border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 mt-6 p-4'>
        <p className='text-gray-500 dark:text-gray-400'>{t('service.termsofuse')}</p>
      </div>
      <div className='mt-6'>
        <Suspense fallback={<ScheduleToggleSwitchSkeleton />}>
          <ScheduleToggleSwitch />
        </Suspense>
      </div>
    </>
  );
};

export default ScheduleForm;
