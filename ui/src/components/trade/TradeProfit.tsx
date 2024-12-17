'use client';

import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { getDiffColor, getDiffPrefix } from '@/utils/color';
import { formatNumber } from '@/utils/number';

import { getProfitAction } from './action';

export const TradeProfitSkeleton = () => {
  const t = useTranslations();

  return (
    <div className='flex flex-col items-center justify-center h-full'>
      <div className='flex items-center'>
        <span className='text-3xl font-bold text-gray-500'>{t('loading')}</span>
      </div>
    </div>
  );
};

export const TradeProfitContent = () => {
  const { data } = useSuspenseQuery({
    queryKey: ['profit'],
    queryFn: getProfitAction,
    initialData: null,
    staleTime: 0,
  });

  const profit = data?.data?.profit ?? 0;

  return (
    <div className='flex flex-col items-center p-6'>
      <span className={`text-3xl font-bold ${getDiffColor(profit)}`}>
        {getDiffPrefix(profit)}
        {formatNumber(profit)}
      </span>
    </div>
  );
};

export function TradeProfit() {
  return (
    <Suspense fallback={<TradeProfitSkeleton />}>
      <TradeProfitContent />
    </Suspense>
  );
}
