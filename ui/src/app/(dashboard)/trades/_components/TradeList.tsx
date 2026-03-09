'use client';
import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { StatusPill } from '@/app/(dashboard)/_shared/report-ui/StatusPill';
import { buildTradeExplanation } from '@/app/(dashboard)/_shared/trades/trade-presentation';
import { PaginatedItem } from '@/shared/types/pagination.types';
import { Trade, initialState } from '@/app/(dashboard)/_shared/trades/trade.types';
import { getDeltaColor, getDeltaPrefix } from '@/utils/color';
import { formatDate } from '@/utils/date';
import { formatNumber } from '@/utils/number';

import { getTradeAction } from '../_actions/trade.actions';
import { TRADE_STYLES } from '@/app/(dashboard)/_shared/trades/trade.styles';

/**
 * Renders the Trade Content UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
const TradeContent = () => {
  const { data } = useSuspenseQuery<PaginatedItem<Trade>>({
    queryKey: ['trades'],
    queryFn: () => getTradeAction(),
    initialData: initialState,
    refetchOnMount: 'always',
  });

  return (
    <TableBody className='divide-y divide-border dark:divide-gray-800'>
      {data.items?.map((item: Trade) => (
        <TradeListItem key={item.id} {...item} />
      ))}
    </TableBody>
  );
};

/**
 * Renders the Trade List Item UI for the dashboard UI.
 * @param item - Input value for item.
 * @returns Rendered React element for this view.
 */
export const TradeListItem: React.FC<Trade> = (item) => {
  const t = useTranslations();
  const explanation = buildTradeExplanation(item, t);

  return (
    <TableRow>
      <TableCell className='whitespace-nowrap'>
        <StatusPill value={t(`trade.types.${item.type}`)} tone={TRADE_STYLES[item.type].tone} />
      </TableCell>
      <TableCell className='px-3 py-3 whitespace-nowrap'>{formatDate(new Date(item.createdAt))}</TableCell>
      <TableCell className='px-3 py-3 whitespace-nowrap'>{item.symbol}</TableCell>
      <TableCell className='px-3 py-3 whitespace-nowrap'>{formatNumber(item.amount)}</TableCell>
      <TableCell className={`px-3 py-3 whitespace-nowrap ${getDeltaColor(item.profit)}`}>
        {getDeltaPrefix(item.profit)}
        {formatNumber(item.profit)}
      </TableCell>
      <TableCell className='px-3 py-3 whitespace-nowrap'>{explanation.summary}</TableCell>
      <TableCell className='px-3 py-3 whitespace-nowrap'>
        {explanation.triageCue ? <StatusPill value={explanation.triageCue} tone='neutral' /> : '-'}
      </TableCell>
    </TableRow>
  );
};

/**
 * Renders the Trade List Item Skeleton UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
export const TradeListItemSkeleton = () => {
  const t = useTranslations();

  return (
    <TableBody className='divide-y divide-border dark:divide-gray-800'>
      <TableRow>
        <TableCell>{t('loading')}</TableCell>
      </TableRow>
    </TableBody>
  );
};

/**
 * Renders the Trade List UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
export const TradeList = () => {
  const t = useTranslations();

  return (
    <SimpleBar>
      <div className='overflow-x-auto'>
        <Table hoverable>
          <TableHead className='dark:border-gray-800'>
            <TableRow>
              <TableHeadCell className='whitespace-nowrap'>{t('trade.type')}</TableHeadCell>
              <TableHeadCell className='whitespace-nowrap'>{t('trade.date')}</TableHeadCell>
              <TableHeadCell className='whitespace-nowrap'>{t('symbol')}</TableHeadCell>
              <TableHeadCell className='whitespace-nowrap'>{t('trade.amount')}</TableHeadCell>
              <TableHeadCell className='whitespace-nowrap'>{t('trade.profit')}</TableHeadCell>
              <TableHeadCell className='whitespace-nowrap'>{t('trade.detail.summary')}</TableHeadCell>
              <TableHeadCell className='whitespace-nowrap'>{t('trade.reason')}</TableHeadCell>
            </TableRow>
          </TableHead>
          <Suspense fallback={<TradeListItemSkeleton />}>
            <TradeContent />
          </Suspense>
        </Table>
      </div>
    </SimpleBar>
  );
};
