'use client';
import React from 'react';

import { useRouter } from 'next/navigation';
import { Badge, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { Trade } from '@/app/(dashboard)/_shared/trades/trade.types';
import { getDiffColor, getDiffPrefix } from '@/utils/color';
import { formatDate } from '@/utils/date';
import { formatNumber } from '@/utils/number';

import { TRADE_STYLES } from '@/app/(dashboard)/_shared/trades/trade.styles';

/**
 * Renders the Trade List24h Skeleton UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
export const TradeList24hSkeleton = () => (
  <div className='animate-pulse px-4 py-6 space-y-3'>
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4' />
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2' />
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6' />
  </div>
);

interface TradeList24hProps {
  items?: Trade[];
  isLoading?: boolean;
}

/**
 * Renders the Trade List24h UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
export function TradeList24h({ items = [], isLoading = false }: TradeList24hProps) {
  const t = useTranslations();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0 overflow-hidden'>
        <div className='px-4 sm:px-6 flex items-center justify-between mb-4'>
          <h5 className='card-title text-dark dark:text-white'>{t('dashboard.trades24h')}</h5>
          <button
            type='button'
            onClick={() => router.push('/trades')}
            className='cursor-pointer text-sm text-primary-600 hover:underline dark:text-primary-400 py-2 px-1 min-h-[44px] min-w-[44px] flex items-center justify-end'
          >
            {t('dashboard.viewAll')}
          </button>
        </div>
        <TradeList24hSkeleton />
      </div>
    );
  }

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0 overflow-hidden'>
      <div className='px-4 sm:px-6 flex items-center justify-between mb-4'>
        <h5 className='card-title text-dark dark:text-white'>{t('dashboard.trades24h')}</h5>
        <button
          type='button'
          onClick={() => router.push('/trades')}
          className='cursor-pointer text-sm text-primary-600 hover:underline dark:text-primary-400 py-2 px-1 min-h-[44px] min-w-[44px] flex items-center justify-end'
        >
          {t('dashboard.viewAll')}
        </button>
      </div>
      <SimpleBar className='min-h-0'>
        <div className='overflow-x-auto min-w-0'>
          <Table hoverable className='w-full text-left min-w-[480px]'>
            <TableHead className='text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700'>
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
                  <TableCell colSpan={5} className='px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm'>
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
                      <Badge className={TRADE_STYLES[item.type]?.badgeStyle ?? ''}>{t(`trade.types.${item.type}`)}</Badge>
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
