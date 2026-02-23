'use client';

import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Badge, Table, TableBody, TableHead, TableHeadCell, TableRow, TableCell } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { PaginatedItem } from '@/shared/types/pagination.types';
import { Trade, initialState } from '@/app/(dashboard)/_shared/trades/trade.types';
import { getDiffColor, getDiffPrefix } from '@/utils/color';
import { formatDate } from '@/utils/date';
import { formatNumber } from '@/utils/number';

import { getTradeAction } from '../_actions/trade.actions';
import { TRADE_STYLES } from '@/app/(dashboard)/_shared/trades/trade.styles';

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

export const TradeListItem: React.FC<Trade> = (item) => {
  const t = useTranslations();

  return (
    <TableRow>
      <TableCell className='whitespace-nowrap'>
        <Badge className={TRADE_STYLES[item.type].badgeStyle}>{t(`trade.types.${item.type}`)}</Badge>
      </TableCell>
      <TableCell className='px-3 py-3 whitespace-nowrap'>{formatDate(new Date(item.createdAt))}</TableCell>
      <TableCell className='px-3 py-3 whitespace-nowrap'>{item.symbol}</TableCell>
      <TableCell className='px-3 py-3 whitespace-nowrap'>{formatNumber(item.amount)}</TableCell>
      <TableCell className={`px-3 py-3 whitespace-nowrap ${getDiffColor(item.profit)}`}>
        {getDiffPrefix(item.profit)}
        {formatNumber(item.profit)}
      </TableCell>
    </TableRow>
  );
};

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
