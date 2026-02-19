'use client';

import { useRouter } from 'next/navigation';
import React from 'react';

import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { getConfidenceColor, getWeightColor } from '@/components/inference/style';
import type { MarketReportWithChange } from '@/interfaces/dashboard.interface';
import { getDiffColor, getDiffPrefix } from '@/utils/color';
import { formatPrice } from '@/utils/number';

import { ContentModal } from './ContentModal';
import { getLatestMarketReportsAction } from './action';

const MarketReportRow = ({
  item,
  t,
  onRowClick,
}: {
  item: MarketReportWithChange;
  t: (k: string) => string;
  onRowClick: (id: string) => void;
}) => {
  const weightPct = Math.floor((item.weight ?? 0) * 100);
  const confidencePct = Math.floor((item.confidence ?? 0) * 100);
  const weightStyle = getWeightColor(item.weight ?? 0);
  const confidenceStyle = getConfidenceColor(item.confidence ?? 0);

  return (
    <TableRow
      role='button'
      tabIndex={0}
      className='cursor-pointer border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
      onClick={() => onRowClick(item.id)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onRowClick(item.id)}
    >
      <TableCell className='px-4 py-3 whitespace-nowrap font-medium text-dark dark:text-white'>{item.symbol}</TableCell>
      <TableCell className='px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-[320px] min-w-0'>
        <div className='flex flex-col gap-y-2'>
          <div className='inline-flex shrink-0 items-center' style={{ gap: '0.375rem' }}>
            <span
              className='rounded px-1.5 py-0.5 text-xs font-medium'
              style={{ backgroundColor: weightStyle.backgroundColor, color: weightStyle.color }}
              title={t('inference.weight')}
            >
              {weightPct}%
            </span>
            <span
              className='rounded px-1.5 py-0.5 text-xs font-medium'
              style={{ backgroundColor: confidenceStyle.backgroundColor, color: confidenceStyle.color }}
              title={t('inference.confidence')}
            >
              {confidencePct}%
            </span>
          </div>
          <span
            className='block wrap-break-word text-gray-600 dark:text-gray-400'
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.reason}
          </span>
        </div>
      </TableCell>
      <TableCell className='px-4 py-3 whitespace-nowrap text-sm'>
        {item.recommendationPrice != null ? formatPrice(item.recommendationPrice) : '-'}
      </TableCell>
      <TableCell className='px-4 py-3 whitespace-nowrap text-sm'>
        {item.currentPrice != null ? formatPrice(item.currentPrice) : '-'}
      </TableCell>
      <TableCell className='px-4 py-3 whitespace-nowrap'>
        {item.priceChangePct != null ? (
          <span className={getDiffColor(item.priceChangePct)}>
            {getDiffPrefix(item.priceChangePct)}
            {item.priceChangePct.toFixed(2)}%
          </span>
        ) : (
          '-'
        )}
      </TableCell>
    </TableRow>
  );
};

export const MarketReportListSkeleton = () => (
  <div className='animate-pulse px-4 py-6 space-y-3'>
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4' />
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2' />
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6' />
  </div>
);

export function MarketReportList() {
  const t = useTranslations();
  const router = useRouter();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const { data, isPending } = useQuery({
    queryKey: ['dashboard', 'market-reports'],
    queryFn: () => getLatestMarketReportsAction(10),
    refetchOnMount: 'always',
  });

  if (isPending) {
    return (
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0 overflow-hidden'>
        <div className='px-4 sm:px-6 flex items-center justify-between mb-4'>
          <h5 className='card-title text-dark dark:text-white'>{t('dashboard.marketReport')}</h5>
          <button
            type='button'
            onClick={() => router.push('/market-recommendations')}
            className='cursor-pointer text-sm text-primary-600 hover:underline dark:text-primary-400 py-2 px-1 min-h-[44px] min-w-[44px] flex items-center justify-end'
          >
            {t('dashboard.viewAll')}
          </button>
        </div>
        <MarketReportListSkeleton />
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0 overflow-hidden'>
      <div className='px-4 sm:px-6 flex items-center justify-between mb-4'>
        <h5 className='card-title text-dark dark:text-white'>{t('dashboard.marketReport')}</h5>
        <button
          type='button'
          onClick={() => router.push('/market-recommendations')}
          className='cursor-pointer text-sm text-primary-600 hover:underline dark:text-primary-400 py-2 px-1 min-h-[44px] min-w-[44px] flex items-center justify-end'
        >
          {t('dashboard.viewAll')}
        </button>
      </div>
      {items.length === 0 ? (
        <div className='px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm'>
          {t('dashboard.emptyMarketReport')}
        </div>
      ) : (
        <SimpleBar className='min-h-0'>
          <div className='overflow-x-auto min-w-0'>
            <Table hoverable className='w-full text-left'>
              <TableHead className='text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700'>
                <TableRow>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('dashboard.columnSymbol')}</TableHeadCell>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('dashboard.columnReason')}</TableHeadCell>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap'>
                    {t('dashboard.columnRecommendationPrice')}
                  </TableHeadCell>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap'>
                    {t('dashboard.columnCurrentPrice')}
                  </TableHeadCell>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap'>
                    {t('dashboard.columnChangePct')}
                  </TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {items.map((item) => (
                  <MarketReportRow key={item.id} item={item} t={t} onRowClick={(id) => setOpenId(id || null)} />
                ))}
              </TableBody>
            </Table>
          </div>
        </SimpleBar>
      )}
      {items.map((item) => (
        <ContentModal
          key={item.id}
          show={openId === item.id}
          onClose={() => setOpenId(null)}
          title={t('dashboard.columnReason')}
        >
          {item.reason}
        </ContentModal>
      ))}
    </div>
  );
}
