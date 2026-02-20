'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';

import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

import { ForbiddenError } from '@/components/error/403';
import ScheduleExecuteButton from '@/components/schedule/ScheduleExecuteButton';
import ScheduleWarning from '@/components/schedule/ScheduleWarning';
import {
  ScheduleActionState,
  ScheduleLockActionState,
  executeBalanceRecommendationWithExistingItemsAction,
  executeMarketRecommendationAction,
  executeReportValidationAction,
  executebalanceRecommendationNewItemsAction,
  getScheduleExecutionPlansAction,
  getScheduleLockStatesAction,
  releaseScheduleLockAction,
} from '@/components/schedule/action';
import { Permission } from '@/interfaces/permission.interface';
import {
  ScheduleExecutionPlanResponse,
  ScheduleExecutionTask,
  ScheduleLockStateResponse,
} from '@/interfaces/schedule-execution.interface';

const LEGACY_SCHEDULE_PERMISSIONS = [
  Permission.EXEC_SCHEDULE_MARKET_RECOMMENDATION,
  Permission.EXEC_SCHEDULE_BALANCE_RECOMMENDATION_EXISTING,
  Permission.EXEC_SCHEDULE_BALANCE_RECOMMENDATION_NEW,
] as const;

const TASK_PERMISSION_MAP: Record<ScheduleExecutionTask, Permission> = {
  marketRecommendation: Permission.EXEC_SCHEDULE_MARKET_RECOMMENDATION,
  balanceRecommendationExisting: Permission.EXEC_SCHEDULE_BALANCE_RECOMMENDATION_EXISTING,
  balanceRecommendationNew: Permission.EXEC_SCHEDULE_BALANCE_RECOMMENDATION_NEW,
  reportValidation: Permission.EXEC_SCHEDULE_REPORT_VALIDATION,
};

interface NextRunHighlight {
  task: ScheduleExecutionTask;
  time: string;
  timezone: string;
  minutesUntil: number;
}

const LOCK_REFRESH_INTERVAL_MS = 15_000;

const parseRunAtToMinutes = (runAt: string): number | null => {
  const [hourRaw, minuteRaw] = runAt.split(':');
  if (!hourRaw || !minuteRaw) {
    return null;
  }

  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
};

const getCurrentMinutesForTimezone = (timezone: string): number | null => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
      return null;
    }

    return hour * 60 + minute;
  } catch {
    return null;
  }
};

const findNearestNextRun = (plans: ScheduleExecutionPlanResponse[]): NextRunHighlight | null => {
  let nearest: NextRunHighlight | null = null;

  for (const plan of plans) {
    const currentMinutes = getCurrentMinutesForTimezone(plan.timezone);
    if (currentMinutes == null) {
      continue;
    }

    for (const runAt of plan.runAt) {
      const targetMinutes = parseRunAtToMinutes(runAt);
      if (targetMinutes == null) {
        continue;
      }

      const minutesUntil =
        targetMinutes >= currentMinutes ? targetMinutes - currentMinutes : 1440 - currentMinutes + targetMinutes;
      if (!nearest || minutesUntil < nearest.minutesUntil) {
        nearest = {
          task: plan.task,
          time: runAt,
          timezone: plan.timezone,
          minutesUntil,
        };
      }
    }
  }

  return nearest;
};

const formatRemainingTime = (minutesUntil: number, t: ReturnType<typeof useTranslations>) => {
  if (minutesUntil <= 0) {
    return t('schedule.execute.auto.remainingSoon');
  }

  if (minutesUntil < 60) {
    return t('schedule.execute.auto.remainingMinutes', { minutes: minutesUntil });
  }

  const hours = Math.floor(minutesUntil / 60);
  const minutes = minutesUntil % 60;

  if (minutes === 0) {
    return t('schedule.execute.auto.remainingHours', { hours });
  }

  return t('schedule.execute.auto.remainingHoursMinutes', { hours, minutes });
};

const toTaskRecord = <T extends { task: ScheduleExecutionTask }>(items: T[]): Partial<Record<ScheduleExecutionTask, T>> => {
  return items.reduce<Partial<Record<ScheduleExecutionTask, T>>>((acc, item) => {
    acc[item.task] = item;
    return acc;
  }, {});
};

const Page: React.FC = () => {
  const { data: session, status: sessionStatus } = useSession();
  const t = useTranslations();
  const permissions = useMemo(() => session?.permissions ?? [], [session?.permissions]);
  const [isExecutePending, startExecuteTransition] = useTransition();
  const [isLockPending, startLockTransition] = useTransition();
  const [recentResults, setRecentResults] = useState<Partial<Record<ScheduleExecutionTask, ScheduleActionState>>>({});
  const [recentLockResults, setRecentLockResults] = useState<
    Partial<Record<ScheduleExecutionTask, ScheduleLockActionState>>
  >({});
  const [executionPlans, setExecutionPlans] = useState<
    Partial<Record<ScheduleExecutionTask, ScheduleExecutionPlanResponse>>
  >({});
  const [lockStates, setLockStates] = useState<Partial<Record<ScheduleExecutionTask, ScheduleLockStateResponse>>>({});
  const [isPlanLoading, setIsPlanLoading] = useState(true);
  const [isLockLoading, setIsLockLoading] = useState(true);

  const taskTitle = (task: ScheduleExecutionTask) => {
    switch (task) {
      case 'marketRecommendation':
        return t('schedule.execute.marketRecommendation.title');
      case 'balanceRecommendationExisting':
        return t('schedule.execute.balanceRecommendationExisting.title');
      case 'reportValidation':
        return t('schedule.execute.reportValidation.title');
      default:
        return t('schedule.execute.balanceRecommendationNew.title');
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadExecutionPlans = async () => {
      const plans = await getScheduleExecutionPlansAction();
      if (!mounted) {
        return;
      }

      setExecutionPlans(toTaskRecord(plans));
      setIsPlanLoading(false);
    };

    void loadExecutionPlans();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadLockStates = async () => {
      const locks = await getScheduleLockStatesAction();
      if (!mounted) {
        return;
      }

      setLockStates(toTaskRecord(locks));
      setIsLockLoading(false);
    };

    void loadLockStates();
    const intervalId = window.setInterval(() => {
      void loadLockStates();
    }, LOCK_REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const refreshLockStates = async () => {
    const locks = await getScheduleLockStatesAction();
    setLockStates(toTaskRecord(locks));
    setIsLockLoading(false);
  };

  const nextRunHighlight = useMemo(() => {
    const plans = Object.values(executionPlans).filter((plan): plan is ScheduleExecutionPlanResponse => {
      if (!plan) {
        return false;
      }

      return permissions.includes(TASK_PERMISSION_MAP[plan.task]);
    });
    return findNearestNextRun(plans);
  }, [executionPlans, permissions]);

  const nextRunRemainingText = nextRunHighlight ? formatRemainingTime(nextRunHighlight.minutesUntil, t) : undefined;

  const execute = (task: ScheduleExecutionTask, executor: () => Promise<ScheduleActionState>) => {
    startExecuteTransition(async () => {
      const result = await executor();
      setRecentResults((prev) => ({
        ...prev,
        [result.task]: result,
      }));

      if (result.status === 'started' || result.status === 'skipped_lock') {
        setLockStates((prev) => ({
          ...prev,
          [task]: {
            task,
            locked: true,
            ttlMs: prev[task]?.ttlMs ?? null,
            checkedAt: new Date().toISOString(),
          },
        }));
      }

      await refreshLockStates();
    });
  };

  const releaseLock = (task: ScheduleExecutionTask) => {
    startLockTransition(async () => {
      const result = await releaseScheduleLockAction(task);
      setRecentLockResults((prev) => ({
        ...prev,
        [result.task]: result,
      }));

      await refreshLockStates();
    });
  };

  const handleExecuteMarketRecommendation = () => {
    execute('marketRecommendation', executeMarketRecommendationAction);
  };

  const handleExecuteExistItems = () => {
    execute('balanceRecommendationExisting', executeBalanceRecommendationWithExistingItemsAction);
  };

  const handleExecuteNewItems = () => {
    execute('balanceRecommendationNew', executebalanceRecommendationNewItemsAction);
  };

  const handleExecuteReportValidation = () => {
    execute('reportValidation', executeReportValidationAction);
  };

  const hasLegacyScheduleAccess = LEGACY_SCHEDULE_PERMISSIONS.every((permission) => permissions.includes(permission));
  const hasReportValidationAccess = permissions.includes(Permission.EXEC_SCHEDULE_REPORT_VALIDATION);
  const hasSchedulePageAccess = hasLegacyScheduleAccess || hasReportValidationAccess;

  if (sessionStatus === 'loading') {
    return null;
  }

  if (!hasSchedulePageAccess) {
    return <ForbiddenError />;
  }

  return (
    <div className='space-y-6'>
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6'>
        <h1 className='text-2xl font-bold text-gray-900 dark:text-white mb-4'>{t('schedule.management.title')}</h1>
        <p className='text-gray-600 dark:text-gray-300 mb-6'>{t('schedule.management.description')}</p>

        <div className='mb-4'>
          <ScheduleWarning />
        </div>

        <div className='mb-4 rounded-lg border border-primary/30 bg-lightprimary/30 px-4 py-3 dark:bg-darkprimary/30'>
          {nextRunHighlight ? (
            <p className='text-sm font-medium text-gray-900 dark:text-white'>
              {t('schedule.execute.auto.nextRunSummary', {
                task: taskTitle(nextRunHighlight.task),
                time: nextRunHighlight.time,
                timezone: nextRunHighlight.timezone,
                remaining: formatRemainingTime(nextRunHighlight.minutesUntil, t),
              })}
            </p>
          ) : (
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              {isPlanLoading ? t('schedule.execute.auto.loading') : t('schedule.execute.auto.nextRunUnavailable')}
            </p>
          )}
        </div>

        <div className='mt-3 border-y border-gray-200 dark:border-gray-700'>
          <div className='hidden lg:grid grid-cols-12 gap-3 bg-gray-50 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800/40 dark:text-gray-400'>
            <div className='col-span-5'>{t('schedule.execute.column.task')}</div>
            <div className='col-span-4'>{t('schedule.execute.column.auto')}</div>
            <div className='col-span-3'>
              <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-3'>
                <span className='text-right'>{t('schedule.execute.column.status')}</span>
                <span className='text-right'>{t('schedule.execute.column.action')}</span>
              </div>
            </div>
          </div>
          <div className='divide-y divide-gray-200 dark:divide-gray-700'>
            <ScheduleExecuteButton
              type='marketRecommendation'
              isPending={isExecutePending}
              isReleasePending={isLockPending}
              onExecute={handleExecuteMarketRecommendation}
              onReleaseLock={() => releaseLock('marketRecommendation')}
              result={recentResults.marketRecommendation}
              lockState={lockStates.marketRecommendation}
              lockResult={recentLockResults.marketRecommendation}
              plan={executionPlans.marketRecommendation}
              isPlanLoading={isPlanLoading}
              isLockLoading={isLockLoading}
              highlightRunAt={nextRunHighlight?.task === 'marketRecommendation' ? nextRunHighlight.time : undefined}
              highlightRemainingText={nextRunHighlight?.task === 'marketRecommendation' ? nextRunRemainingText : undefined}
            />

            <ScheduleExecuteButton
              type='existItems'
              isPending={isExecutePending}
              isReleasePending={isLockPending}
              onExecute={handleExecuteExistItems}
              onReleaseLock={() => releaseLock('balanceRecommendationExisting')}
              result={recentResults.balanceRecommendationExisting}
              lockState={lockStates.balanceRecommendationExisting}
              lockResult={recentLockResults.balanceRecommendationExisting}
              plan={executionPlans.balanceRecommendationExisting}
              isPlanLoading={isPlanLoading}
              isLockLoading={isLockLoading}
              highlightRunAt={nextRunHighlight?.task === 'balanceRecommendationExisting' ? nextRunHighlight.time : undefined}
              highlightRemainingText={
                nextRunHighlight?.task === 'balanceRecommendationExisting' ? nextRunRemainingText : undefined
              }
            />

            <ScheduleExecuteButton
              type='newItems'
              isPending={isExecutePending}
              isReleasePending={isLockPending}
              onExecute={handleExecuteNewItems}
              onReleaseLock={() => releaseLock('balanceRecommendationNew')}
              result={recentResults.balanceRecommendationNew}
              lockState={lockStates.balanceRecommendationNew}
              lockResult={recentLockResults.balanceRecommendationNew}
              plan={executionPlans.balanceRecommendationNew}
              isPlanLoading={isPlanLoading}
              isLockLoading={isLockLoading}
              highlightRunAt={nextRunHighlight?.task === 'balanceRecommendationNew' ? nextRunHighlight.time : undefined}
              highlightRemainingText={nextRunHighlight?.task === 'balanceRecommendationNew' ? nextRunRemainingText : undefined}
            />

            <ScheduleExecuteButton
              type='reportValidation'
              isPending={isExecutePending}
              isReleasePending={isLockPending}
              onExecute={handleExecuteReportValidation}
              onReleaseLock={() => releaseLock('reportValidation')}
              result={recentResults.reportValidation}
              lockState={lockStates.reportValidation}
              lockResult={recentLockResults.reportValidation}
              plan={executionPlans.reportValidation}
              isPlanLoading={isPlanLoading}
              isLockLoading={isLockLoading}
              highlightRunAt={nextRunHighlight?.task === 'reportValidation' ? nextRunHighlight.time : undefined}
              highlightRemainingText={nextRunHighlight?.task === 'reportValidation' ? nextRunRemainingText : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
