'use client';
import React from 'react';

import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { TradeTypeText } from '@/app/(dashboard)/_shared/trades/TradeTypeText';
import { Trade } from '@/app/(dashboard)/_shared/trades/trade.types';
import { getDiffColor, getDiffPrefix } from '@/utils/color';
import { formatDate } from '@/utils/date';
import { formatNumber } from '@/utils/number';
import type { TradeList24hProps } from './home.types';

/**
 * Renders the trade list 24h skeleton.
 * @returns Rendered React element.
 */
export const TradeList24hSkeleton = () => (
  <div className='animate-pulse space-y-3 px-4 py-6'>
    <div className='h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700' />
    <div className='h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700' />
    <div className='h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700' />
  </div>
);

/**
 * Renders the trade list for last 24h.
 * @param params - Input values.
 * @returns Rendered React element.
 */
export function TradeList24h({ items = [], isLoading = false }: TradeList24hProps) {
  const t = useTranslations();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className='relative w-full min-h-0 overflow-hidden rounded-xl bg-white px-0 pt-6 shadow-md dark:bg-dark dark:shadow-dark-md'>
        <div className='mb-4 flex items-center justify-between px-4 sm:px-6'>
          <h5 className='card-title text-dark dark:text-white'>{t('dashboard.trades24h')}</h5>
          <button
            type='button'
            onClick={() => router.push('/trades')}
            className='flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-end px-1 py-2 text-sm text-primary-600 hover:underline dark:text-primary-400'
          >
            {t('dashboard.viewAll')}
          </button>
        </div>
        <TradeList24hSkeleton />
      </div>
    );
  }

  return (
    <div className='relative w-full min-h-0 overflow-hidden rounded-xl bg-white px-0 pt-6 shadow-md dark:bg-dark dark:shadow-dark-md'>
      <div className='mb-4 flex items-center justify-between px-4 sm:px-6'>
        <h5 className='card-title text-dark dark:text-white'>{t('dashboard.trades24h')}</h5>
        <button
          type='button'
          onClick={() => router.push('/trades')}
          className='flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-end px-1 py-2 text-sm text-primary-600 hover:underline dark:text-primary-400'
        >
          {t('dashboard.viewAll')}
        </button>
      </div>
      <SimpleBar className='min-h-0'>
        <div className='min-w-0 overflow-x-auto'>
          <Table hoverable className='min-w-[480px] w-full text-left'>
            <TableHead className='border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400'>
              <TableRow>
                <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('trade.type')}</TableHeadCell>
                <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('trade.date')}</TableHeadCell>
                <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('symbol')}</TableHeadCell>
                <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('trade.amount')}</TableHeadCell>
                <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('trade.profit')}</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className='divide-y divide-gray-200 dark:divide-gray-700'>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400'>
                    {t('dashboard.emptyTrades24h')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item: Trade) => (
                  <TableRow
                    key={item.id}
                    className='border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  >
                    <TableCell className='px-4 py-3 whitespace-nowrap'>
                      <TradeTypeText type={item.type} label={t(`trade.types.${item.type}`)} />
                    </TableCell>
                    <TableCell className='px-4 py-3 whitespace-nowrap text-sm'>
                      {formatDate(new Date(item.createdAt))}
                    </TableCell>
                    <TableCell className='px-4 py-3 whitespace-nowrap text-sm'>{item.symbol}</TableCell>
                    <TableCell className='px-4 py-3 whitespace-nowrap text-sm'>{formatNumber(item.amount)}</TableCell>
                    <TableCell className={`px-4 py-3 whitespace-nowrap text-sm ${getDiffColor(item.profit)}`}>
                      {getDiffPrefix(item.profit)}
                      {formatNumber(item.profit)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SimpleBar>
    </div>
  );
}
