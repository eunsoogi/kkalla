'use client';
import React from 'react';

import { useTranslations } from 'next-intl';

import { getDiffColor, getDiffPrefix } from '@/utils/color';
import { formatNumber } from '@/utils/number';

interface ProfitDashboardProps {
  isLoading?: boolean;
  profit?: number;
  todayProfit?: number;
}

/**
 * Renders the Profit Dashboard Skeleton UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
export const ProfitDashboardSkeleton = () => (
  <div className='animate-pulse px-4 py-6 space-y-3'>
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto' />
    <div className='h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto' />
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mx-auto mt-4' />
    <div className='h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/5 mx-auto' />
  </div>
);

/**
 * Renders the Profit Dashboard UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
export function ProfitDashboard({ isLoading = false, profit = 0, todayProfit = 0 }: ProfitDashboardProps) {
  const t = useTranslations();

  if (isLoading) {
    return <ProfitDashboardSkeleton />;
  }

  return (
    <div className='flex flex-col gap-4 p-4 sm:p-6'>
      <div className='flex flex-col items-center'>
        <span className='text-sm text-gray-500 dark:text-gray-400'>{t('dashboard.totalProfit')}</span>
        <span className={`text-3xl font-bold ${getDiffColor(profit)}`}>
          {getDiffPrefix(profit)}
          {formatNumber(profit)}
          <span className='text-lg font-normal text-gray-500 dark:text-gray-400'> {t('dashboard.currencyKrw')}</span>
        </span>
      </div>
      <div className='flex flex-col items-center border-t border-gray-200 dark:border-gray-700 pt-4'>
        <span className='text-sm text-gray-500 dark:text-gray-400'>{t('dashboard.todayProfit')}</span>
        <span className={`text-xl font-semibold ${getDiffColor(todayProfit)}`}>
          {getDiffPrefix(todayProfit)}
          {formatNumber(todayProfit)}
          <span className='text-sm font-normal text-gray-500 dark:text-gray-400'> {t('dashboard.currencyKrw')}</span>
        </span>
      </div>
    </div>
  );
}
