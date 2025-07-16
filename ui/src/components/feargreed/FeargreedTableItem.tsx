'use client';

import React from 'react';

import { Table } from 'flowbite-react';
import { useFormatter, useTranslations } from 'next-intl';

import { Feargreed } from '@/interfaces/feargreed.interface';
import { getDiffColor, getDiffPrefix } from '@/utils/color';

export const FeargreedTableItem: React.FC<Feargreed | null> = (item) => {
  const formatter = useFormatter();

  if (!item) {
    return null;
  }

  const diff = item.diff ?? 0; // 이전 값과의 차이

  return (
    <Table.Row>
      <Table.Cell className='px-3 py-3 whitespace-nowrap'>
        {formatter.relativeTime(new Date(item.date))}
      </Table.Cell>
      <Table.Cell className='px-3 py-3 whitespace-nowrap'>{item.value.toLocaleString()}</Table.Cell>
      <Table.Cell className={`px-3 py-3 whitespace-nowrap ${getDiffColor(diff)}`}>
        {getDiffPrefix(diff)}
        {diff.toLocaleString()}
      </Table.Cell>
      <Table.Cell className='px-3 py-3 whitespace-nowrap'>{item.classification}</Table.Cell>
    </Table.Row>
  );
};

export const FeargreedTableSkeleton: React.FC = () => {
  const t = useTranslations();

  return (
    <Table.Body className='divide-y divide-border dark:divide-gray-800'>
      <Table.Row>
        <Table.Cell>{t('loading')}</Table.Cell>
      </Table.Row>
    </Table.Body>
  );
};
