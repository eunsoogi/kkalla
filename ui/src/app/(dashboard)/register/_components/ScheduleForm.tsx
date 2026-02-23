'use client';

import React, { useState, useTransition } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Checkbox, Label, ToggleSwitch } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import { Schedule, initialState } from '@/app/(dashboard)/register/_types/schedule.types';

import { getScheduleAction, postScheduleAction } from '@/app/(dashboard)/_shared/settings/_actions/settings.actions';

type ScheduleToggleSwitchProps = {
  isRiskAcknowledged: boolean;
};

const ScheduleToggleSwitch: React.FC<ScheduleToggleSwitchProps> = ({ isRiskAcknowledged }) => {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const queryKey = ['schedule'];

  const { data, isLoading } = useQuery<Schedule>({
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

  if (isLoading) {
    return (
        <div className='flex items-center gap-4'>
          <ToggleSwitch checked={false} onChange={() => null} label={t('activate')} disabled />
        </div>
      );
  }

  return (
    <div className='flex items-center gap-4'>
      <ToggleSwitch
        checked={data?.enabled ?? false}
        onChange={handleToggle}
        disabled={isPending || (!isRiskAcknowledged && !(data?.enabled ?? false))}
        label={t('activate')}
      />
    </div>
  );
};

const ScheduleForm: React.FC = () => {
  const t = useTranslations();
  const [isRiskAcknowledged, setRiskAcknowledged] = useState(false);

  return (
    <>
      <div className='flex flex-col items-start gap-2 text-left w-full'>
        <h5 className='card-title text-dark dark:text-white'>{t('service.activation_title')}</h5>
      </div>
      <div className='mt-6 rounded-lg border border-amber-200 dark:border-amber-500 bg-amber-50/80 dark:bg-amber-500/10 p-4'>
        <p className='text-sm font-semibold text-amber-700 dark:text-amber-300'>{t('service.registerFlow.risk_summary')}</p>
        <p className='mt-2 text-sm text-amber-700 dark:text-amber-200'>{t('service.registerFlow.risk_note')}</p>
        <details className='group mt-3'>
          <summary className='cursor-pointer text-sm font-medium text-primary'>{t('service.registerFlow.risk_open')}</summary>
          <p className='mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300'>{t('service.termsofuse')}</p>
        </details>
        <div className='mt-4'>
          <div className='flex items-start gap-3'>
            <Checkbox
              id='riskAcknowledged'
              checked={isRiskAcknowledged}
              onChange={(event) => setRiskAcknowledged(event.target.checked)}
            />
            <Label className='mt-0.5' htmlFor='riskAcknowledged'>
              {t('service.registerFlow.risk_ack_label')}
            </Label>
          </div>
        </div>
      </div>
      <div className='mt-6'>
        <ScheduleToggleSwitch isRiskAcknowledged={isRiskAcknowledged} />
      </div>
    </>
  );
};

export default ScheduleForm;
