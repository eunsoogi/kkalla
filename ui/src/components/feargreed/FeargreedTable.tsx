'use client';

import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Table, TableBody, TableHead, TableHeadCell, TableRow } from 'flowbite-react';
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
    refetchOnMount: 'always',
  });

  if (!data || !data.data.length) {
    return null;
  }

  return (
    <TableBody className='divide-y divide-border dark:divide-gray-800'>
      {data.data.map((item, index) => (
        <FeargreedTableItem key={`${item.timestamp}-${index}`} {...item} />
      ))}
    </TableBody>
  );
};

export const FeargreedTable = () => {
  const t = useTranslations();

  return (
    <SimpleBar>
      <div className='overflow-x-auto'>
        <Table hoverable>
          <TableHead className='dark:border-gray-800'>
            <TableRow>
              <TableHeadCell className='whitespace-nowrap'>{t('feargreed.date')}</TableHeadCell>
              <TableHeadCell className='whitespace-nowrap'>{t('feargreed.score')}</TableHeadCell>
              <TableHeadCell className='whitespace-nowrap'>{t('feargreed.change')}</TableHeadCell>
              <TableHeadCell className='whitespace-nowrap'>{t('feargreed.stage')}</TableHeadCell>
            </TableRow>
          </TableHead>
          <Suspense fallback={<FeargreedTableSkeleton />}>
            <FeargreedTableContent />
          </Suspense>
        </Table>
      </div>
    </SimpleBar>
  );
};
