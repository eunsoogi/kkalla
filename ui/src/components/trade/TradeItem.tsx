'use client';

import React from 'react';

import { Badge, Table } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { Trade } from '@/interfaces/trade.interface';
import { formatDate } from '@/utils/date';

import { TRADE_STYLES } from './style';

export const TradeItem = (item: Trade) => {
  return (
    <Table.Row>
      <Table.Cell className='whitespace-nowrap'>
        <Badge className={TRADE_STYLES[item.type].badgeStyle}>{item.type}</Badge>
      </Table.Cell>
      <Table.Cell className='px-3 py-3 whitespace-nowrap'>{formatDate(new Date(item.createdAt))}</Table.Cell>
      <Table.Cell className='px-3 py-3 whitespace-nowrap'>
        {item.symbol}/{item.market}
      </Table.Cell>
      <Table.Cell className='px-3 py-3 whitespace-nowrap'>{item.amount.toLocaleString()}</Table.Cell>
    </Table.Row>
  );
};

export const TradeSkeleton = () => {
  const t = useTranslations();

  return (
    <Table.Body className='divide-y divide-border dark:divide-gray-800'>
      <Table.Row>
        <Table.Cell>{t('loading')}</Table.Cell>
      </Table.Row>
    </Table.Body>
  );
};
