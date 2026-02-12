'use client';

import React from 'react';

import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { getDiffColor, getDiffPrefix } from '@/utils/color';
import { formatPrice } from '@/utils/number';

import type { HoldingWithDailyChange } from '@/interfaces/dashboard.interface';

import { getHoldingsAction } from './action';

const HoldingRow = ({ item }: { item: HoldingWithDailyChange }) => (
  <TableRow className='border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'>
    <TableCell className='px-4 py-3 whitespace-nowrap font-medium text-dark dark:text-white'>{item.symbol}</TableCell>
    <TableCell className='px-4 py-3 whitespace-nowrap text-sm'>
      {item.currentPrice != null ? formatPrice(item.currentPrice) : '-'}
    </TableCell>
    <TableCell className='px-4 py-3 whitespace-nowrap'>
      {item.dailyChangePct != null ? (
        <span className={getDiffColor(item.dailyChangePct)}>
          {getDiffPrefix(item.dailyChangePct)}
          {item.dailyChangePct.toFixed(2)}%
        </span>
      ) : (
        <span className='text-gray-500'>-</span>
      )}
    </TableCell>
  </TableRow>
);

export const HoldingsListSkeleton = () => (
  <div className='animate-pulse px-4 py-6 space-y-3'>
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4' />
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2' />
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6' />
  </div>
);

export function HoldingsList() {
  const t = useTranslations();
  const { data, isPending } = useQuery({
    queryKey: ['dashboard', 'holdings'],
    queryFn: getHoldingsAction,
    refetchOnMount: 'always',
  });

  if (isPending) {
    return (
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0 overflow-hidden'>
        <div className='px-4 sm:px-6'>
          <h5 className='card-title text-dark dark:text-white mb-4'>{t('dashboard.holdings')}</h5>
        </div>
        <HoldingsListSkeleton />
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0 overflow-hidden'>
      <div className='px-4 sm:px-6'>
        <h5 className='card-title text-dark dark:text-white mb-4'>{t('dashboard.holdings')}</h5>
      </div>
      {items.length === 0 ? (
        <div className='px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm'>
          {t('dashboard.emptyHoldings')}
        </div>
      ) : (
        <SimpleBar className='min-h-0'>
          <div className='overflow-x-auto min-w-0'>
            <Table hoverable className='w-full text-left'>
              <TableHead className='text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700'>
                <TableRow>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('dashboard.columnSymbol')}</TableHeadCell>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('dashboard.columnCurrentPrice')}</TableHeadCell>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('dashboard.columnDailyChange')}</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {items.map((item, index) => (
                  <HoldingRow key={`${item.symbol}-${index}`} item={item} />
                ))}
              </TableBody>
            </Table>
          </div>
        </SimpleBar>
      )}
    </div>
  );
}
