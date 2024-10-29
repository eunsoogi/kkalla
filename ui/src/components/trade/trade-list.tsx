'use client';

import React, { Suspense } from 'react';

import { Badge, Table } from 'flowbite-react';
import SimpleBar from 'simplebar-react';

import { formatDate } from '@/common/date';

import { useInferencesSuspenseQuery } from './hook';
import { Trade } from './type';

const TRADE_STYLES = {
  buy: {
    badgeStyle: 'text-success bg-lightsuccess',
  },
  sell: {
    badgeStyle: 'text-error bg-lighterror',
  },
} as const;

const TradeContent = () => {
  const { data } = useInferencesSuspenseQuery();

  return (
    <Table.Body className='divide-y divide-border dark:divide-darkborder'>
      {data.items.map((item: Trade) => (
        <Table.Row key={item.id}>
          <Table.Cell className='whitespace-nowrap'>
            <Badge className={TRADE_STYLES[item.type].badgeStyle}>{item.type}</Badge>
          </Table.Cell>
          <Table.Cell className='whitespace-nowrap'>
            <div className='me-5'>
              <p className='text-base'>{formatDate(new Date(item.createdAt))}</p>
            </div>
          </Table.Cell>
          <Table.Cell className='whitespace-nowrap'>
            {item.symbol}
          </Table.Cell>
          <Table.Cell className='whitespace-nowrap'>
            {item.cost.toLocaleString()}
          </Table.Cell>
          <Table.Cell className='whitespace-nowrap'>
            {item.balance.krw.toLocaleString()}
          </Table.Cell>
          <Table.Cell className='whitespace-nowrap'>
            {item.balance.coin.toLocaleString()}
          </Table.Cell>
        </Table.Row>
      ))}
    </Table.Body>
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
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray pt-6 px-0 relative w-full break-words'>
        <div className='px-6'>
          <h5 className='card-title mb-6'>거래 목록</h5>
        </div>
        <SimpleBar>
          <div className='overflow-x-auto'>
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell className='whitespace-nowrap'>방식</Table.HeadCell>
                <Table.HeadCell className='whitespace-nowrap'>날짜</Table.HeadCell>
                <Table.HeadCell className='whitespace-nowrap'>항목</Table.HeadCell>
                <Table.HeadCell className='whitespace-nowrap'>비용</Table.HeadCell>
                <Table.HeadCell className='whitespace-nowrap'>원화 보유량</Table.HeadCell>
                <Table.HeadCell className='whitespace-nowrap'>코인 보유량</Table.HeadCell>
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
