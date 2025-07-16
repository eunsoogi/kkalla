'use client';

import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Table } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { FeargreedHistory } from '@/interfaces/feargreed.interface';

import { FeargreedTableItem, FeargreedTableSkeleton } from './FeargreedTableItem';
import { getFeargreedHistoryAction } from './action';

const FeargreedTableContent: React.FC = () => {
  const { data } = useSuspenseQuery<FeargreedHistory | null>({
    queryKey: ['feargreeds-history'],
    queryFn: () => getFeargreedHistoryAction(7), // 최근 7일 데이터
    initialData: null,
    staleTime: 0,
  });

  if (!data || !data.data.length) {
    return null;
  }

  return (
    <Table.Body className='divide-y divide-border dark:divide-gray-800'>
      {data.data.map((item, index) => (
        <FeargreedTableItem key={`${item.timestamp}-${index}`} {...item} />
      ))}
    </Table.Body>
  );
};

export const FeargreedTable = () => {
  const t = useTranslations();

  return (
    <SimpleBar>
      <div className='overflow-x-auto'>
        <Table hoverable>
          <Table.Head className='dark:border-gray-800'>
            <Table.HeadCell className='whitespace-nowrap'>{t('feargreed.date')}</Table.HeadCell>
            <Table.HeadCell className='whitespace-nowrap'>{t('feargreed.score')}</Table.HeadCell>
            <Table.HeadCell className='whitespace-nowrap'>{t('feargreed.change')}</Table.HeadCell>
            <Table.HeadCell className='whitespace-nowrap'>{t('feargreed.stage')}</Table.HeadCell>
          </Table.Head>
          <Suspense fallback={<FeargreedTableSkeleton />}>
            <FeargreedTableContent />
          </Suspense>
        </Table>
      </div>
    </SimpleBar>
  );
};
