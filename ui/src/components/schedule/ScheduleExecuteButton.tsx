'use client';

import React from 'react';

import { Button } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Permission } from '@/interfaces/permission.interface';
import type { ScheduleExecutionPlanResponse } from '@/interfaces/schedule-execution.interface';

import type { ScheduleActionState } from './action';

interface ScheduleExecuteButtonProps {
  type: 'marketRecommendation' | 'existItems' | 'newItems' | 'reportValidation';
  isPending: boolean;
  onExecute: () => void;
  result?: ScheduleActionState;
  plan?: ScheduleExecutionPlanResponse;
  isPlanLoading: boolean;
  highlightRunAt?: string;
  highlightRemainingText?: string;
}

const ScheduleExecuteButton: React.FC<ScheduleExecuteButtonProps> = ({
  type,
  isPending,
  onExecute,
  result,
  plan,
  isPlanLoading,
  highlightRunAt,
  highlightRemainingText,
}) => {
  const t = useTranslations();

  const STATUS_STYLES: Record<ScheduleActionState['status'], string> = {
    started: 'text-success bg-lightsuccess dark:text-white dark:bg-success',
    skipped_lock: 'text-warning bg-lightwarning dark:text-white dark:bg-warning',
    failed: 'text-error bg-lighterror dark:text-white dark:bg-error',
  };

  const config = {
    marketRecommendation: {
      permission: Permission.EXEC_SCHEDULE_MARKET_RECOMMENDATION,
      title: t('schedule.execute.marketRecommendation.title'),
      description: t('schedule.execute.marketRecommendation.description'),
      button: t('schedule.execute.marketRecommendation.button'),
    },
    existItems: {
      permission: Permission.EXEC_SCHEDULE_BALANCE_RECOMMENDATION_EXISTING,
      title: t('schedule.execute.balanceRecommendationExisting.title'),
      description: t('schedule.execute.balanceRecommendationExisting.description'),
      button: t('schedule.execute.balanceRecommendationExisting.button'),
    },
    newItems: {
      permission: Permission.EXEC_SCHEDULE_BALANCE_RECOMMENDATION_NEW,
      title: t('schedule.execute.balanceRecommendationNew.title'),
      description: t('schedule.execute.balanceRecommendationNew.description'),
      button: t('schedule.execute.balanceRecommendationNew.button'),
    },
    reportValidation: {
      permission: Permission.EXEC_SCHEDULE_REPORT_VALIDATION,
      title: t('schedule.execute.reportValidation.title'),
      description: t('schedule.execute.reportValidation.description'),
      button: t('schedule.execute.reportValidation.button'),
    },
  };

  const currentConfig = config[type];

  const statusLabel = (status: ScheduleActionState['status']) => {
    switch (status) {
      case 'started':
        return t('schedule.execute.statusLabel.started');
      case 'skipped_lock':
        return t('schedule.execute.statusLabel.skippedLock');
      default:
        return t('schedule.execute.statusLabel.failed');
    }
  };

  const formatRequestedAt = (requestedAt: string) => {
    const requestedDate = new Date(requestedAt);
    return Number.isNaN(requestedDate.getTime()) ? requestedAt : requestedDate.toLocaleString();
  };

  return (
    <PermissionGuard permissions={[currentConfig.permission]}>
      <div className='grid grid-cols-1 gap-y-5 px-4 py-5 lg:grid-cols-12 lg:items-start lg:gap-x-6 lg:gap-y-4 lg:px-5'>
        <div className='min-w-0 lg:col-span-5'>
          <h3 className='text-[15px] font-semibold text-gray-900 dark:text-white'>{currentConfig.title}</h3>
          <p className='mt-2 text-sm text-gray-600 dark:text-gray-300'>{currentConfig.description}</p>
        </div>

        <div className='min-w-0 lg:col-span-4'>
          <p className='mb-2 text-xs font-medium text-gray-500 dark:text-gray-400'>
            {t('schedule.execute.auto.label')}
          </p>
          {isPlanLoading ? (
            <p className='text-sm text-gray-400 dark:text-gray-500'>{t('schedule.execute.auto.loading')}</p>
          ) : plan ? (
            <>
              <div className='flex flex-wrap gap-1.5'>
                {plan.runAt.map((time) => {
                  const isHighlighted = highlightRunAt === time;
                  return (
                    <span
                      key={`${plan.task}-${time}`}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
                        isHighlighted
                          ? 'bg-lightprimary text-primary dark:bg-primary dark:text-white'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {time}
                      {isHighlighted && (
                        <span className='inline-flex items-center rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold leading-none opacity-95 dark:bg-black/20'>
                          {t('schedule.execute.auto.nextRunBadge')}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
              {highlightRunAt && highlightRemainingText && (
                <p className='mt-1 text-xs text-primary dark:text-primary'>
                  {t('schedule.execute.auto.nextRunIn', { remaining: highlightRemainingText })}
                </p>
              )}
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                {t('schedule.execute.auto.timezone', { timezone: plan.timezone })}
              </p>
            </>
          ) : (
            <p className='text-sm text-gray-400 dark:text-gray-500'>{t('schedule.execute.auto.unavailable')}</p>
          )}
        </div>

        <div className='lg:col-span-3'>
          <div className='grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-3'>
            <div className='flex min-w-0 flex-col items-start gap-2 lg:items-end'>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400'>
                {t('schedule.execute.status.label')}
              </p>
              {result ? (
                <>
                  <span
                    className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[result.status]}`}
                  >
                    {statusLabel(result.status)}
                  </span>
                  <span className='text-xs text-gray-500 dark:text-gray-400 lg:text-right'>
                    {formatRequestedAt(result.requestedAt)}
                  </span>
                </>
              ) : (
                <span className='text-xs text-gray-400 dark:text-gray-500'>
                  {t('schedule.execute.statusLabel.idle')}
                </span>
              )}
            </div>

            <div className='flex items-center lg:justify-end'>
              <Button color='primary' onClick={onExecute} disabled={isPending} className='w-full whitespace-nowrap'>
                {isPending ? t('schedule.execute.executing') : currentConfig.button}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
};

export default ScheduleExecuteButton;
