'use client';

import React from 'react';

import { Badge, Table } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { Trade } from '@/interfaces/trade.interface';
import { formatDate } from '@/utils/date';

import { TRADE_STYLES } from './style';

const getProfitColor = (profit: number) => {
  return profit > 0 ? 'text-green-500' : profit < 0 ? 'text-red-500' : 'text-gray-500';
};

const getProfitPrefix = (profit: number) => {
  return profit > 0 ? '+' : '';
};

export const TradeListItem: React.FC<Trade> = (item) => {
  return (
    <Table.Row>
      <Table.Cell className='whitespace-nowrap'>
        <Badge className={TRADE_STYLES[item.type].badgeStyle}>{item.type}</Badge>
      </Table.Cell>
      <Table.Cell className='px-3 py-3 whitespace-nowrap'>{formatDate(new Date(item.createdAt))}</Table.Cell>
      <Table.Cell className='px-3 py-3 whitespace-nowrap'>{item.ticker}</Table.Cell>
      <Table.Cell className='px-3 py-3 whitespace-nowrap'>{item.amount.toLocaleString()}</Table.Cell>
      <Table.Cell className={`px-3 py-3 whitespace-nowrap ${getProfitColor(item.profit)}`}>
        {getProfitPrefix(item.profit)}
        {item.profit.toLocaleString()}
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
