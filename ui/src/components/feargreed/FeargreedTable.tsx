'use client';

import React from 'react';

import { Table, TableBody, TableHead, TableHeadCell, TableRow } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { FeargreedHistory } from '@/interfaces/feargreed.interface';

import { FeargreedTableItem } from './FeargreedTableItem';

export const FeargreedTableSkeletonBlock = () => (
  <div className='min-h-[120px] animate-pulse px-4 py-6 space-y-3' role='status' aria-label='loading'>
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4' />
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2' />
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6' />
  </div>
);

interface FeargreedTableProps {
  history?: FeargreedHistory | null;
  isLoading?: boolean;
}

export const FeargreedTable = ({ history = null, isLoading = false }: FeargreedTableProps) => {
  const t = useTranslations();

  if (isLoading) {
    return <FeargreedTableSkeletonBlock />;
  }

  if (!history?.data?.length) {
    return null;
  }

  return (
    <SimpleBar className='min-h-0'>
      <div className='overflow-x-auto min-w-0'>
        <Table hoverable className='w-full text-left'>
          <TableHead className='text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700'>
            <TableRow>
              <TableHeadCell className='w-0 px-4 py-3 whitespace-nowrap' />
              <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('feargreed.date')}</TableHeadCell>
              <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('feargreed.score')}</TableHeadCell>
              <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('feargreed.change')}</TableHeadCell>
              <TableHeadCell className='px-4 py-3 whitespace-nowrap'>{t('feargreed.stage')}</TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody className='divide-y divide-gray-200 dark:divide-gray-700'>
            {history.data.map((item, index) => (
              <FeargreedTableItem key={`${item.timestamp}-${index}`} {...item} />
            ))}
          </TableBody>
        </Table>
      </div>
    </SimpleBar>
  );
};
