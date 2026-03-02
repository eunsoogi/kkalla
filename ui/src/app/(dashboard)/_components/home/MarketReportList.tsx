'use client';
import { useRouter } from 'next/navigation';
import React from 'react';

import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { formatDate } from '@/utils/date';
import { formatPercent, formatPrice } from '@/utils/number';
import type { MarketReportListProps, MarketReportRowProps } from './home.types';

import { ContentModal } from '@/app/(dashboard)/_shared/ui/ContentModal';
import { getDiffColor, getDiffPrefix } from '@/utils/color';

/**
 * Renders the market report table row.
 * @param params - Input values.
 * @returns Rendered React element.
 */
const MarketReportRow = ({ item, onRowClick }: MarketReportRowProps) => {
  return (
    <TableRow
      role='button'
      tabIndex={0}
      className='cursor-pointer border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
      onClick={() => onRowClick(item.id)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onRowClick(item.id)}
    >
      <TableCell className='px-4 py-3 whitespace-nowrap font-medium text-dark dark:text-white'>{item.symbol}</TableCell>
      <TableCell className='px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300'>
        {formatPercent(item.confidence, 2)}
      </TableCell>
      <TableCell className='px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300'>
        {formatPercent(item.weight, 2)}
      </TableCell>
      <TableCell className='px-4 py-3 whitespace-nowrap text-sm'>
        {item.recommendationPrice != null ? formatPrice(item.recommendationPrice) : '-'}
      </TableCell>
      <TableCell className='px-4 py-3 whitespace-nowrap text-sm'>
        {item.currentPrice != null ? formatPrice(item.currentPrice) : '-'}
      </TableCell>
      <TableCell className='px-4 py-3 whitespace-nowrap text-sm'>
        {item.priceChangePct != null ? (
          <span className={getDiffColor(item.priceChangePct)}>
            {getDiffPrefix(item.priceChangePct)}
            {item.priceChangePct.toFixed(2)}%
          </span>
        ) : (
          '-'
        )}
      </TableCell>
      <TableCell className='px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300'>
        {item.createdAt ? formatDate(new Date(item.createdAt)) : '-'}
      </TableCell>
    </TableRow>
  );
};

/**
 * Renders the market report list skeleton.
 * @returns Rendered React element.
 */
export const MarketReportListSkeleton = () => (
  <div className='animate-pulse space-y-3 px-4 py-6'>
    <div className='h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700' />
    <div className='h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700' />
    <div className='h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700' />
  </div>
);

/**
 * Renders the market report list.
 * @param params - Input values.
 * @returns Rendered React element.
 */
export function MarketReportList({ items = [], isLoading = false }: MarketReportListProps) {
  const t = useTranslations();
  const router = useRouter();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const selected = items.find((item) => item.id === openId) ?? null;

  if (isLoading) {
    return (
      <div className='relative w-full min-h-0 overflow-hidden rounded-xl bg-white px-0 pt-6 shadow-md dark:bg-dark dark:shadow-dark-md'>
        <div className='mb-4 flex items-center justify-between px-4 sm:px-6'>
          <h5 className='card-title text-dark dark:text-white'>{t('dashboard.marketReport')}</h5>
          <button
            type='button'
            onClick={() => router.push('/market-signals')}
            className='flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-end px-1 py-2 text-sm text-primary-600 hover:underline dark:text-primary-400'
          >
            {t('dashboard.viewAll')}
          </button>
        </div>
        <MarketReportListSkeleton />
      </div>
    );
  }

  return (
    <div className='relative w-full min-h-0 overflow-hidden rounded-xl bg-white px-0 pt-6 shadow-md dark:bg-dark dark:shadow-dark-md'>
      <div className='mb-4 flex items-center justify-between px-4 sm:px-6'>
        <h5 className='card-title text-dark dark:text-white'>{t('dashboard.marketReport')}</h5>
        <button
          type='button'
          onClick={() => router.push('/market-signals')}
          className='flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-end px-1 py-2 text-sm text-primary-600 hover:underline dark:text-primary-400'
        >
          {t('dashboard.viewAll')}
        </button>
      </div>
      {items.length === 0 ? (
        <div className='px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400'>{t('dashboard.emptyMarketReport')}</div>
      ) : (
        <SimpleBar className='min-h-0'>
          <div className='min-w-0 overflow-x-auto'>
            <Table hoverable className='min-w-[1080px] w-full text-left'>
              <TableHead className='border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400'>
                <TableRow>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('dashboard.columnSymbol')}</TableHeadCell>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('inference.confidence')}</TableHeadCell>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('inference.weight')}</TableHeadCell>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap'>
                    {t('dashboard.columnRecommendationPrice')}
                  </TableHeadCell>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('dashboard.columnCurrentPrice')}</TableHeadCell>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('dashboard.columnChangePct')}</TableHeadCell>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('dashboard.columnTime')}</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {items.map((item) => (
                  <MarketReportRow key={item.id} item={item} onRowClick={setOpenId} />
                ))}
              </TableBody>
            </Table>
          </div>
        </SimpleBar>
      )}
      <ContentModal
        show={selected != null}
        onClose={() => setOpenId(null)}
        title={selected?.symbol ?? ''}
        renderMarkdown
      >
        {selected?.reason ?? '-'}
      </ContentModal>
    </div>
  );
}
