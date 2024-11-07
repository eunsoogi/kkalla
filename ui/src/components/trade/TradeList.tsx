'use client';

import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Badge, Table } from 'flowbite-react';
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
      <Table.Cell className='p-2 lg:px-4 lg:py-3 whitespace-nowrap'>
        <div className='me-5'>
          <p className='text-base'>{formatDate(new Date(item.createdAt))}</p>
        </div>
      </Table.Cell>
      <Table.Cell className='p-2 lg:px-4 lg:py-3 whitespace-nowrap'>
        {item.symbol}/{item.market}
      </Table.Cell>
      <Table.Cell className='p-2 lg:px-4 lg:py-3 whitespace-nowrap'>{item.amount.toLocaleString()}</Table.Cell>
    </Table.Row>
  );
};

const TradeSkeleton = () => {
  return (
    <Table.Body className='divide-y divide-border dark:divide-darkborder'>
      <Table.Row>
        <Table.Cell>로딩 중...</Table.Cell>
      </Table.Row>
    </Table.Body>
  );
};

const TradeList = () => {
  return (
    <>
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray pt-6 px-0 relative w-full min-h-full break-words'>
        <div className='px-6'>
          <h5 className='card-title mb-6'>거래 목록</h5>
        </div>
        <SimpleBar>
          <div className='overflow-x-auto'>
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell className='whitespace-nowrap'>거래</Table.HeadCell>
                <Table.HeadCell className='whitespace-nowrap'>날짜</Table.HeadCell>
                <Table.HeadCell className='whitespace-nowrap'>종목</Table.HeadCell>
                <Table.HeadCell className='whitespace-nowrap'>비용</Table.HeadCell>
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
