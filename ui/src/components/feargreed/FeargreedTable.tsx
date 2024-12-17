'use client';

import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Table } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { Feargreed } from '@/interfaces/feargreed.interface';

import { FeargreedTableItem, FeargreedTableSkeleton } from './FeargreedTableItem';
import { getFeargreedAction } from './action';

const FeargreedTableContent: React.FC = () => {
  const { data } = useSuspenseQuery<Feargreed | null>({
    queryKey: ['feargreeds'],
    queryFn: () => getFeargreedAction(),
    initialData: null,
    staleTime: 0,
  });

  if (!data) {
    return null;
  }

  return <FeargreedTableItem {...data} />;
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
