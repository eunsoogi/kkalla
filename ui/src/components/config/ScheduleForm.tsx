'use client';

import React, { Suspense, useTransition } from 'react';

import { Icon } from '@iconify/react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ToggleSwitch, Tooltip } from 'flowbite-react';

import { Schedule, initialState } from '@/interfaces/schedule.interface';

import { getScheduleAction, postScheduleAction } from './action';

const ScheduleToggleSwitch: React.FC = () => {
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

  return <ToggleSwitch checked={data.enabled} onChange={handleToggle} disabled={isPending} label='활성화' />;
};

const ScheduleToggleSwitchSkeleton: React.FC = () => {
  return <ToggleSwitch checked={false} onChange={() => null} label='활성화' />;
};

const ScheduleForm: React.FC = () => {
  return (
    <>
      <div className='flex flex-column items-center gap-2'>
        <h5 className='card-title'>매매 스케줄</h5>
        <Tooltip content='등록된 API 키를 활용해 4시간마다 추론 및 매매를 수행합니다.'>
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
