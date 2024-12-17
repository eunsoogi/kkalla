'use client';

import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Badge, Table } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { PaginatedItem } from '@/interfaces/item.interface';
import { Trade, initialState } from '@/interfaces/trade.interface';
import { getDiffColor, getDiffPrefix } from '@/utils/color';
import { formatDate } from '@/utils/date';
import { formatNumber } from '@/utils/number';

import { getTradeAction } from './action';
import { TRADE_STYLES } from './style';

const TradeContent = () => {
  const { data } = useSuspenseQuery<PaginatedItem<Trade>>({
    queryKey: ['trades'],
    queryFn: getTradeAction,
    initialData: initialState,
    staleTime: 0,
  });

  return (
    <Table.Body className='divide-y divide-border dark:divide-gray-800'>
      {data.items?.map((item: Trade) => <TradeListItem key={item.id} {...item} />)}
    </Table.Body>
  );
};

export const TradeListItem: React.FC<Trade> = (item) => {
  return (
    <Table.Row>
      <Table.Cell className='whitespace-nowrap'>
        <Badge className={TRADE_STYLES[item.type].badgeStyle}>{item.type}</Badge>
      </Table.Cell>
      <Table.Cell className='px-3 py-3 whitespace-nowrap'>{formatDate(new Date(item.createdAt))}</Table.Cell>
      <Table.Cell className='px-3 py-3 whitespace-nowrap'>{item.ticker}</Table.Cell>
      <Table.Cell className='px-3 py-3 whitespace-nowrap'>{formatNumber(item.amount)}</Table.Cell>
      <Table.Cell className={`px-3 py-3 whitespace-nowrap ${getDiffColor(item.profit)}`}>
        {getDiffPrefix(item.profit)}
        {formatNumber(item.profit)}
      </Table.Cell>
    </Table.Row>
  );
};

export const TradeListItemSkeleton = () => {
  const t = useTranslations();

  return (
    <Table.Body className='divide-y divide-border dark:divide-gray-800'>
      <Table.Row>
        <Table.Cell>{t('loading')}</Table.Cell>
      </Table.Row>
    </Table.Body>
  );
};

export const TradeList = () => {
  const t = useTranslations();

  return (
    <SimpleBar>
      <div className='overflow-x-auto'>
        <Table hoverable>
          <Table.Head className='dark:border-gray-800'>
            <Table.HeadCell className='whitespace-nowrap'>{t('trade.type')}</Table.HeadCell>
            <Table.HeadCell className='whitespace-nowrap'>{t('trade.date')}</Table.HeadCell>
            <Table.HeadCell className='whitespace-nowrap'>{t('trade.ticker')}</Table.HeadCell>
            <Table.HeadCell className='whitespace-nowrap'>{t('trade.amount')}</Table.HeadCell>
            <Table.HeadCell className='whitespace-nowrap'>{t('trade.profit')}</Table.HeadCell>
          </Table.Head>
          <Suspense fallback={<TradeListItemSkeleton />}>
            <TradeContent />
          </Suspense>
        </Table>
      </div>
    </SimpleBar>
  );
};
