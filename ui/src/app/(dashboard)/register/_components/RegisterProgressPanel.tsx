'use client';

import React from 'react';

import { useQuery } from '@tanstack/react-query';
import { Badge } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { getCategoriesAction } from '@/app/(dashboard)/register/_actions/category.actions';
import { getScheduleAction, getUpbitStatusAction } from '@/app/(dashboard)/_shared/settings/_actions/settings.actions';
import { ApikeyStatus } from '@/enums/apikey.enum';
import { Category } from '@/app/(dashboard)/register/_types/category.types';
import { Schedule, initialState as initialScheduleState } from '@/app/(dashboard)/register/_types/schedule.types';

interface ChecklistItem {
  label: string;
  detail: string;
  complete: boolean;
}

const RegisterProgressPanel: React.FC = () => {
  const t = useTranslations();

  const { data: upbitStatus = ApikeyStatus.UNKNOWN } = useQuery<ApikeyStatus>({
    queryKey: ['upbit', 'status'],
    queryFn: getUpbitStatusAction,
    initialData: ApikeyStatus.UNKNOWN,
    refetchOnMount: 'always',
  });

  const { data: schedule = initialScheduleState } = useQuery<Schedule>({
    queryKey: ['schedule'],
    queryFn: getScheduleAction,
    initialData: initialScheduleState,
    refetchOnMount: 'always',
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      try {
        return await getCategoriesAction();
      } catch {
        return [];
      }
    },
    initialData: [],
    refetchOnMount: 'always',
  });

  const isUpbitRegistered = upbitStatus === ApikeyStatus.REGISTERED;
  const enabledCategoryCount = categories.filter((category) => category.enabled).length;
  const hasCategory = enabledCategoryCount > 0;
  const isServiceEnabled = schedule.enabled;

  const checklistItems: ChecklistItem[] = [
    {
      label: t('service.registerFlow.checklist_upbit'),
      detail: isUpbitRegistered ? t('status.registered') : t('status.unknown'),
      complete: isUpbitRegistered,
    },
    {
      label: t('service.registerFlow.checklist_categories'),
      detail: hasCategory
        ? t('category.selected_count', { count: enabledCategoryCount })
        : t('category.selected_empty'),
      complete: hasCategory,
    },
    {
      label: t('service.registerFlow.checklist_schedule'),
      detail: isServiceEnabled ? t('service.registerFlow.schedule_on') : t('service.registerFlow.schedule_off'),
      complete: isServiceEnabled,
    },
  ];

  const completeCount = checklistItems.filter((item) => item.complete).length;
  const progressPercent = Math.round((completeCount / checklistItems.length) * 100);

  const nextAction = !isUpbitRegistered
    ? t('service.registerFlow.next_upbit')
    : !hasCategory
      ? t('service.registerFlow.next_categories')
      : !isServiceEnabled
        ? t('service.registerFlow.next_schedule')
        : t('service.registerFlow.next_complete');

  return (
    <aside className='rounded-xl shadow-md dark:shadow-dark-md bg-white dark:bg-dark p-6'>
      <div className='flex items-start justify-between gap-3 flex-nowrap'>
        <div>
          <h3 className='text-base font-semibold text-dark dark:text-white'>{t('service.registerFlow.progress_title')}</h3>
          <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>{t('service.registerFlow.progress_description')}</p>
        </div>
        <Badge className='shrink-0 whitespace-nowrap' color={completeCount === checklistItems.length ? 'success' : 'gray'}>
          {t('service.registerFlow.completed', { done: completeCount, total: checklistItems.length })}
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
              {item.complete ? t('service.registerFlow.checklist_done') : t('service.registerFlow.checklist_pending')}
            </Badge>
          </div>
        ))}
      </div>

      <div className='mt-6 rounded-lg border border-lightprimary bg-lightprimary dark:bg-primary dark:border-primary p-4'>
        <p className='text-xs font-semibold uppercase tracking-wide text-primary dark:text-white'>
          {t('service.registerFlow.next_action')}
        </p>
        <p className='mt-2 text-sm text-primary dark:text-white'>{nextAction}</p>
      </div>
    </aside>
  );
};

export default RegisterProgressPanel;
