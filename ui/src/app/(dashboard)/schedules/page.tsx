'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';

import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

import { ForbiddenError } from '@/components/error/403';
import ScheduleExecuteButton from '@/components/schedule/ScheduleExecuteButton';
import ScheduleWarning from '@/components/schedule/ScheduleWarning';
import {
  ScheduleActionState,
  executeBalanceRecommendationWithExistingItemsAction,
  executeMarketRecommendationAction,
  executeReportValidationAction,
  executebalanceRecommendationNewItemsAction,
  getScheduleExecutionPlansAction,
} from '@/components/schedule/action';
import { Permission } from '@/interfaces/permission.interface';
import { ScheduleExecutionPlanResponse, ScheduleExecutionTask } from '@/interfaces/schedule-execution.interface';

const LEGACY_SCHEDULE_PERMISSIONS = [
  Permission.EXEC_SCHEDULE_MARKET_RECOMMENDATION,
  Permission.EXEC_SCHEDULE_BALANCE_RECOMMENDATION_EXISTING,
  Permission.EXEC_SCHEDULE_BALANCE_RECOMMENDATION_NEW,
] as const;

interface NextRunHighlight {
  task: ScheduleExecutionTask;
  time: string;
  timezone: string;
  minutesUntil: number;
}

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

const Page: React.FC = () => {
  const { data: session, status: sessionStatus } = useSession();
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [recentResults, setRecentResults] = useState<Partial<Record<ScheduleExecutionTask, ScheduleActionState>>>({});
  const [executionPlans, setExecutionPlans] = useState<
    Partial<Record<ScheduleExecutionTask, ScheduleExecutionPlanResponse>>
  >({});
  const [isPlanLoading, setIsPlanLoading] = useState(true);

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

      const plansByTask = plans.reduce<Partial<Record<ScheduleExecutionTask, ScheduleExecutionPlanResponse>>>(
        (acc, plan) => {
          acc[plan.task] = plan;
          return acc;
        },
        {},
      );

      setExecutionPlans(plansByTask);
      setIsPlanLoading(false);
    };

    void loadExecutionPlans();

    return () => {
      mounted = false;
    };
  }, []);

  const nextRunHighlight = useMemo(() => {
    const plans = Object.values(executionPlans).filter((plan): plan is ScheduleExecutionPlanResponse => !!plan);
    return findNearestNextRun(plans);
  }, [executionPlans]);

  const nextRunRemainingText = nextRunHighlight ? formatRemainingTime(nextRunHighlight.minutesUntil, t) : undefined;

  const execute = (executor: () => Promise<ScheduleActionState>) => {
    startTransition(async () => {
      const result = await executor();
      setRecentResults((prev) => ({
        ...prev,
        [result.task]: result,
      }));
    });
  };

  const handleExecuteMarketRecommendation = () => {
    execute(executeMarketRecommendationAction);
  };

  const handleExecuteExistItems = () => {
    execute(executeBalanceRecommendationWithExistingItemsAction);
  };

  const handleExecuteNewItems = () => {
    execute(executebalanceRecommendationNewItemsAction);
  };

  const handleExecuteReportValidation = () => {
    execute(executeReportValidationAction);
  };

  const permissions = session?.permissions ?? [];
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
              isPending={isPending}
              onExecute={handleExecuteMarketRecommendation}
              result={recentResults.marketRecommendation}
              plan={executionPlans.marketRecommendation}
              isPlanLoading={isPlanLoading}
              highlightRunAt={nextRunHighlight?.task === 'marketRecommendation' ? nextRunHighlight.time : undefined}
              highlightRemainingText={nextRunHighlight?.task === 'marketRecommendation' ? nextRunRemainingText : undefined}
            />

            <ScheduleExecuteButton
              type='existItems'
              isPending={isPending}
              onExecute={handleExecuteExistItems}
              result={recentResults.balanceRecommendationExisting}
              plan={executionPlans.balanceRecommendationExisting}
              isPlanLoading={isPlanLoading}
              highlightRunAt={nextRunHighlight?.task === 'balanceRecommendationExisting' ? nextRunHighlight.time : undefined}
              highlightRemainingText={
                nextRunHighlight?.task === 'balanceRecommendationExisting' ? nextRunRemainingText : undefined
              }
            />

            <ScheduleExecuteButton
              type='newItems'
              isPending={isPending}
              onExecute={handleExecuteNewItems}
              result={recentResults.balanceRecommendationNew}
              plan={executionPlans.balanceRecommendationNew}
              isPlanLoading={isPlanLoading}
              highlightRunAt={nextRunHighlight?.task === 'balanceRecommendationNew' ? nextRunHighlight.time : undefined}
              highlightRemainingText={nextRunHighlight?.task === 'balanceRecommendationNew' ? nextRunRemainingText : undefined}
            />

            <ScheduleExecuteButton
              type='reportValidation'
              isPending={isPending}
              onExecute={handleExecuteReportValidation}
              result={recentResults.reportValidation}
              plan={executionPlans.reportValidation}
              isPlanLoading={isPlanLoading}
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
