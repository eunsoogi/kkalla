'use client';

import React from 'react';

import { Table } from 'flowbite-react';
import { useFormatter, useTranslations } from 'next-intl';

import { Feargreed } from '@/interfaces/feargreed.interface';
import { getDiffColor, getDiffPrefix } from '@/utils/color';

export const FeargreedTableItem: React.FC<Feargreed | null> = (item) => {
  const intervals = item?.intv ?? [];
  const formatter = useFormatter();

  return (
    <Table.Body className='divide-y divide-border dark:divide-gray-800'>
      {intervals.map((interval, index) => (
        <Table.Row key={index}>
          <Table.Cell className='px-3 py-3 whitespace-nowrap'>
            {formatter.relativeTime(new Date(interval.date))}
          </Table.Cell>
          <Table.Cell className='px-3 py-3 whitespace-nowrap'>{interval.score.toLocaleString()}</Table.Cell>
          <Table.Cell className={`px-3 py-3 whitespace-nowrap ${getDiffColor(interval.diff)}`}>
            {getDiffPrefix(interval.diff)}
            {interval.diff.toLocaleString()}
          </Table.Cell>
          <Table.Cell className='px-3 py-3 whitespace-nowrap'>{interval.stage}</Table.Cell>
        </Table.Row>
      ))}
    </Table.Body>
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
