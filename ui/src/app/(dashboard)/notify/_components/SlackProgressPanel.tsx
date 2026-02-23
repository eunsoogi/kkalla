'use client';

import React from 'react';

import { useQuery } from '@tanstack/react-query';
import { Badge } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { getSlackConfigAction, getSlackStatusAction } from '@/app/(dashboard)/_shared/settings/_actions/settings.actions';
import { ApikeyStatus } from '@/enums/apikey.enum';
import { SlackConfig, initialState as initialSlackConfigState } from '@/app/(dashboard)/notify/_types/slack.types';

interface ChecklistItem {
  label: string;
  detail: string;
  complete: boolean;
}

const SlackProgressPanel: React.FC = () => {
  const t = useTranslations();

  const { data: slackStatus = ApikeyStatus.UNKNOWN } = useQuery<ApikeyStatus>({
    queryKey: ['slack', 'status'],
    queryFn: getSlackStatusAction,
    initialData: ApikeyStatus.UNKNOWN,
    refetchOnMount: 'always',
  });

  const { data: slackConfig = initialSlackConfigState } = useQuery<SlackConfig>({
    queryKey: ['slack', 'config'],
    queryFn: getSlackConfigAction,
    initialData: initialSlackConfigState,
    refetchOnMount: 'always',
  });

  const hasChannel = (slackConfig?.channel ?? '').trim().length > 0;
  const isSlackRegistered = slackStatus === ApikeyStatus.REGISTERED;

  const checklistItems: ChecklistItem[] = [
    {
      label: t('notify.registerFlow.checklist_token'),
      detail: isSlackRegistered ? t('status.registered') : t('status.unknown'),
      complete: isSlackRegistered,
    },
    {
      label: t('notify.registerFlow.checklist_channel'),
      detail: hasChannel ? t('notify.registerFlow.channel_set') : t('notify.registerFlow.channel_missing'),
      complete: hasChannel,
    },
  ];

  const completeCount = checklistItems.filter((item) => item.complete).length;
  const progressPercent = Math.round((completeCount / checklistItems.length) * 100);

  const nextAction = !isSlackRegistered
    ? t('notify.registerFlow.next_token')
    : !hasChannel
      ? t('notify.registerFlow.next_channel')
      : t('notify.registerFlow.next_complete');

  return (
    <aside className='rounded-xl shadow-md dark:shadow-dark-md bg-white dark:bg-dark p-6'>
      <div className='flex items-start justify-between gap-3 flex-nowrap'>
        <div>
          <h3 className='text-base font-semibold text-dark dark:text-white'>{t('notify.registerFlow.progress_title')}</h3>
          <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>{t('notify.registerFlow.progress_description')}</p>
        </div>
        <Badge className='shrink-0 whitespace-nowrap' color={completeCount === checklistItems.length ? 'success' : 'gray'}>
          {t('notify.registerFlow.completed', { done: completeCount, total: checklistItems.length })}
        </Badge>
      </div>

      <div className='mt-4 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800'>
        <div
          className='h-full rounded-full bg-primary transition-all duration-300'
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className='mt-6 space-y-3'>
        {checklistItems.map((item) => (
          <div
            key={item.label}
            className='flex items-center justify-between gap-4 rounded-lg border border-gray-100 dark:border-gray-700 p-3'
          >
            <div>
              <p className='text-sm font-medium text-dark dark:text-white'>{item.label}</p>
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>{item.detail}</p>
            </div>
            <Badge className='shrink-0 whitespace-nowrap' color={item.complete ? 'success' : 'gray'}>
              {item.complete ? t('notify.registerFlow.checklist_done') : t('notify.registerFlow.checklist_pending')}
            </Badge>
          </div>
        ))}
      </div>

      <div className='mt-6 rounded-lg border border-lightprimary bg-lightprimary dark:bg-primary dark:border-primary p-4'>
        <p className='text-xs font-semibold uppercase tracking-wide text-primary dark:text-white'>
          {t('notify.registerFlow.next_action')}
        </p>
        <p className='mt-2 text-sm text-primary dark:text-white'>{nextAction}</p>
      </div>
    </aside>
  );
};

export default SlackProgressPanel;
