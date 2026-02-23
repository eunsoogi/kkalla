'use client';

import React from 'react';

import { Button } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { PermissionGuard } from '@/app/(dashboard)/_shared/auth/PermissionGuard';
import { Permission } from '@/shared/types/permission.types';
import type { ScheduleExecutionPlanResponse, ScheduleLockStateResponse } from '../_types/schedule-execution.types';
import type { ScheduleActionState, ScheduleLockActionState } from '../_actions/schedule.actions';

interface ScheduleExecuteButtonProps {
  type: 'marketSignal' | 'allocationRecommendationExisting' | 'allocationRecommendationNew' | 'allocationAudit';
  isPending: boolean;
  isReleasePending: boolean;
  onExecute: () => void;
  onReleaseLock: () => void;
  result?: ScheduleActionState;
  lockState?: ScheduleLockStateResponse;
  lockResult?: ScheduleLockActionState;
  plan?: ScheduleExecutionPlanResponse;
  isPlanLoading: boolean;
  isLockLoading: boolean;
  highlightRunAt?: string;
  highlightRemainingText?: string;
}

const ScheduleExecuteButton: React.FC<ScheduleExecuteButtonProps> = ({
  type,
  isPending,
  isReleasePending,
  onExecute,
  onReleaseLock,
  result,
  lockState,
  lockResult,
  plan,
  isPlanLoading,
  isLockLoading,
  highlightRunAt,
  highlightRemainingText,
}) => {
  const t = useTranslations();

  const STATUS_STYLES: Record<ScheduleActionState['status'], string> = {
    started: 'text-success bg-lightsuccess dark:text-white dark:bg-success',
    skipped_lock: 'text-warning bg-lightwarning dark:text-white dark:bg-warning',
    failed: 'text-error bg-lighterror dark:text-white dark:bg-error',
  };

  const LOCK_STATUS_STYLES = {
    locked: 'text-warning bg-lightwarning dark:text-white dark:bg-warning',
    unlocked: 'text-success bg-lightsuccess dark:text-white dark:bg-success',
  };

  const LOCK_RESULT_STYLES: Record<ScheduleLockActionState['status'], string> = {
    released: 'text-success',
    already_unlocked: 'text-gray-500 dark:text-gray-400',
    failed: 'text-error',
  };

  const config = {
    marketSignal: {
      permission: Permission.EXEC_SCHEDULE_MARKET_SIGNAL,
      title: t('schedule.execute.marketSignal.title'),
      description: t('schedule.execute.marketSignal.description'),
      button: t('schedule.execute.marketSignal.button'),
    },
    allocationRecommendationExisting: {
      permission: Permission.EXEC_SCHEDULE_ALLOCATION_RECOMMENDATION_EXISTING,
      title: t('schedule.execute.allocationRecommendationExisting.title'),
      description: t('schedule.execute.allocationRecommendationExisting.description'),
      button: t('schedule.execute.allocationRecommendationExisting.button'),
    },
    allocationRecommendationNew: {
      permission: Permission.EXEC_SCHEDULE_ALLOCATION_RECOMMENDATION_NEW,
      title: t('schedule.execute.allocationRecommendationNew.title'),
      description: t('schedule.execute.allocationRecommendationNew.description'),
      button: t('schedule.execute.allocationRecommendationNew.button'),
    },
    allocationAudit: {
      permission: Permission.EXEC_SCHEDULE_ALLOCATION_AUDIT,
      title: t('schedule.execute.allocationAudit.title'),
      description: t('schedule.execute.allocationAudit.description'),
      button: t('schedule.execute.allocationAudit.button'),
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

  const formatDateTime = (dateString: string) => {
    const parsedDate = new Date(dateString);
    return Number.isNaN(parsedDate.getTime()) ? dateString : parsedDate.toLocaleString();
  };

  const formatLockTtl = (ttlMs: number | null) => {
    if (ttlMs == null || ttlMs < 0) {
      return t('schedule.execute.lock.ttlUnknown');
    }

    const totalSeconds = Math.ceil(ttlMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
      return t('schedule.execute.lock.ttlMinutesSeconds', { minutes, seconds });
    }

    return t('schedule.execute.lock.ttlSeconds', { seconds });
  };

  const lockStatusLabel = lockState?.locked ? t('schedule.execute.lock.locked') : t('schedule.execute.lock.unlocked');
  const lockStatusStyle = lockState?.locked ? LOCK_STATUS_STYLES.locked : LOCK_STATUS_STYLES.unlocked;

  const isReleaseDisabled = isPending || isReleasePending || isLockLoading || !lockState?.locked;

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

          <div className='mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/40'>
            <p className='text-xs font-medium text-gray-500 dark:text-gray-400'>{t('schedule.execute.lock.label')}</p>
            {isLockLoading ? (
              <p className='mt-1 text-xs text-gray-400 dark:text-gray-500'>{t('schedule.execute.lock.loading')}</p>
            ) : lockState ? (
              <>
                <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-medium ${lockStatusStyle}`}>
                  {lockStatusLabel}
                </span>
                <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                  {t('schedule.execute.lock.ttl', { value: formatLockTtl(lockState.ttlMs) })}
                </p>
                <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                  {t('schedule.execute.lock.checkedAt', { at: formatDateTime(lockState.checkedAt) })}
                </p>
              </>
            ) : (
              <p className='mt-1 text-xs text-gray-400 dark:text-gray-500'>{t('schedule.execute.lock.unavailable')}</p>
            )}
          </div>
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
                    {formatDateTime(result.requestedAt)}
                  </span>
                </>
              ) : (
                <span className='text-xs text-gray-400 dark:text-gray-500'>
                  {t('schedule.execute.statusLabel.idle')}
                </span>
              )}
              {lockResult && (
                <>
                  <span className={`text-xs font-medium ${LOCK_RESULT_STYLES[lockResult.status]}`}>{lockResult.message}</span>
                  {typeof lockResult.recoveredRunningCount === 'number' && (
                    <span className='text-xs text-gray-500 dark:text-gray-400 lg:text-right'>
                      {t('schedule.execute.lock.recoveredRunningCount', {
                        count: lockResult.recoveredRunningCount,
                      })}
                    </span>
                  )}
                  <span className='text-xs text-gray-500 dark:text-gray-400 lg:text-right'>
                    {formatDateTime(lockResult.releasedAt)}
                  </span>
                </>
              )}
            </div>

            <div className='flex flex-col gap-2 lg:items-end'>
              <Button color='primary' onClick={onExecute} disabled={isPending} className='w-full whitespace-nowrap'>
                {isPending ? t('schedule.execute.executing') : currentConfig.button}
              </Button>

              <Button
                color='gray'
                onClick={onReleaseLock}
                disabled={isReleaseDisabled}
                className='w-full whitespace-nowrap'
              >
                {isReleasePending ? t('schedule.execute.lock.releasing') : t('schedule.execute.lock.releaseButton')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
};

export default ScheduleExecuteButton;
