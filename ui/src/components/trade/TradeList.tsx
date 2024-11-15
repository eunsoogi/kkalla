'use client';

import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Table } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { PaginatedItem } from '@/interfaces/item.interface';
import { Trade, initialState } from '@/interfaces/trade.interface';

import { TradeItem, TradeSkeleton } from './TradeItem';
import { getTradeAction } from './action';

const TradeContent = () => {
  const { data } = useSuspenseQuery<PaginatedItem<Trade>>({
    queryKey: ['trades'],
    queryFn: getTradeAction,
    initialData: initialState,
    staleTime: 0,
  });

  return (
    <Table.Body className='divide-y divide-border dark:divide-gray-800'>
      {data.items?.map((item: Trade) => <TradeItem key={item.id} {...item} />)}
    </Table.Body>
  );
};

export const TradeList = () => {
  const t = useTranslations();

  return (
    <>
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-full break-words'>
        <div className='px-6'>
          <h5 className='card-title text-dark dark:text-white mb-6'>{t('trade.list')}</h5>
        </div>
        <SimpleBar>
          <div className='overflow-x-auto'>
            <Table hoverable>
              <Table.Head className='dark:border-gray-800'>
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
