'use client';

import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { getProfitAction } from './action';

const getProfitColor = (profit: number) => {
  return profit > 0 ? 'text-green-500' : profit < 0 ? 'text-red-500' : 'text-gray-500';
};

const getProfitPrefix = (profit: number) => {
  return profit > 0 ? '+' : '';
};

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
      <span className={`text-3xl font-bold ${getProfitColor(profit)}`}>
        {getProfitPrefix(profit)}
        {profit.toLocaleString()}
      </span>
    </div>
  );
};

export function TradeProfit() {
  const t = useTranslations();

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-6 relative w-full break-words'>
      <h5 className='card-title text-dark dark:text-white'>{t('trade.profit')}</h5>
      <Suspense fallback={<TradeProfitSkeleton />}>
        <TradeProfitContent />
      </Suspense>
    </div>
  );
}
