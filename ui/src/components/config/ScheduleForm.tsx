'use client';

import React, { Suspense, useTransition } from 'react';

import { Icon } from '@iconify/react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ToggleSwitch, Tooltip } from 'flowbite-react';
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
    staleTime: 0,
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
        <h5 className='card-title'>{t('schedule.title')}</h5>
        <Tooltip content={t('schedule.tooltip')}>
          <Icon icon='solar:info-circle-outline' height='1.125rem' className='text-dark' />
        </Tooltip>
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
