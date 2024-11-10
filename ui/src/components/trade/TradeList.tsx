'use client';

import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Badge, Table } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { PaginatedItem } from '@/interfaces/item.interface';
import { Trade, initialState } from '@/interfaces/trade.interface';
import { formatDate } from '@/utils/date';

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
    <Table.Body className='divide-y divide-border dark:divide-darkborder'>
      {data.items?.map((item: Trade) => <TradeItem key={item.id} {...item} />)}
    </Table.Body>
  );
};

const TradeItem = (item: Trade) => {
  return (
    <Table.Row>
      <Table.Cell className='whitespace-nowrap'>
        <Badge className={TRADE_STYLES[item.type].badgeStyle}>{item.type}</Badge>
      </Table.Cell>
      <Table.Cell className='p-2 lg:px-4 lg:py-3 whitespace-nowrap'>{formatDate(new Date(item.createdAt))}</Table.Cell>
      <Table.Cell className='p-2 lg:px-4 lg:py-3 whitespace-nowrap'>
        {item.symbol}/{item.market}
      </Table.Cell>
      <Table.Cell className='p-2 lg:px-4 lg:py-3 whitespace-nowrap'>{item.amount.toLocaleString()}</Table.Cell>
    </Table.Row>
  );
};

const TradeSkeleton = () => {
  const t = useTranslations();

  return (
    <Table.Body className='divide-y divide-border dark:divide-darkborder'>
      <Table.Row>
        <Table.Cell>{t('loading')}</Table.Cell>
      </Table.Row>
    </Table.Body>
  );
};

const TradeList = () => {
  const t = useTranslations();

  return (
    <>
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray pt-6 px-0 relative w-full min-h-full break-words'>
        <div className='px-6'>
          <h5 className='card-title mb-6'>{t('trade.list')}</h5>
        </div>
        <SimpleBar>
          <div className='overflow-x-auto'>
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell className='whitespace-nowrap'>{t('trade.type')}</Table.HeadCell>
                <Table.HeadCell className='whitespace-nowrap'>{t('trade.date')}</Table.HeadCell>
                <Table.HeadCell className='whitespace-nowrap'>{t('trade.ticker')}</Table.HeadCell>
                <Table.HeadCell className='whitespace-nowrap'>{t('trade.cost')}</Table.HeadCell>
              </Table.Head>
              <Suspense fallback={<TradeSkeleton />}>
                <TradeContent />
              </Suspense>
            </Table>
          </div>
        </SimpleBar>
      </div>
    </>
  );
};

export default TradeList;
