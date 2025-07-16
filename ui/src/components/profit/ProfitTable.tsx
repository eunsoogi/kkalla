'use client';

import React, { Suspense } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Table } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { PaginatedItem } from '@/interfaces/item.interface';
import { ProfitData, initialPaginatedState } from '@/interfaces/profit.interface';
import { getDiffColor, getDiffPrefix } from '@/utils/color';
import { formatNumber } from '@/utils/number';

import { getProfitsAction } from './action';

const profitsQueryKey = ['profits'];

export interface ProfitTableProps {
  page: number;
  email?: string;
  onPageChange: (page: number) => void;
}

const ProfitTableItem = ({ email, profit }: ProfitData) => {
  return (
    <Table.Row>
      <Table.Cell className='whitespace-nowrap'>{email}</Table.Cell>
      <Table.Cell className={`whitespace-nowrap ${getDiffColor(profit)}`}>
        {getDiffPrefix(profit)}
        {formatNumber(profit)}
      </Table.Cell>
    </Table.Row>
  );
};

const ProfitTableBase = ({
  items,
  onPageChange,
}: {
  items: PaginatedItem<ProfitData>;
  onPageChange: (page: number) => void;
}) => {
  const t = useTranslations();

  return (
    <>
      <SimpleBar>
        <div className='overflow-x-auto'>
          <Table hoverable>
            <Table.Head className='dark:border-gray-800'>
              <Table.HeadCell className='whitespace-nowrap'>{t('user.email')}</Table.HeadCell>
              <Table.HeadCell className='whitespace-nowrap'>{t('trade.profit')}</Table.HeadCell>
            </Table.Head>
            <Table.Body className='divide-y divide-border dark:divide-gray-800'>
              {items.items.map((profit) => (
                <ProfitTableItem key={profit.email} {...profit} />
              ))}
            </Table.Body>
          </Table>
        </div>
      </SimpleBar>
      <div className='mt-4 flex items-center justify-between px-6 pb-6'>
        <div className='text-sm text-gray-700 dark:text-gray-300'>
          {t('pagination', {
            start: (items.page - 1) * (items.perPage ?? 1) + 1,
            end: Math.min(items.page * (items.perPage ?? 1), items.total),
            total: items.total,
          })}
        </div>
        <div className='flex space-x-2'>
          {Array.from({ length: items.totalPages }, (_, i) => (
            <button
              key={i + 1}
              className={`px-3 py-1 text-sm rounded ${
                items.page === i + 1
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 dark:bg-dark dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
              disabled={items.page === i + 1}
              onClick={() => onPageChange(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

const ProfitTableSkeleton = () => {
  return (
    <>
      <div className='animate-pulse'>
        <div className='h-6 bg-gray-200 rounded dark:bg-gray-700 w-1/4 mb-6 mx-6' />
        <div className='space-y-4 px-6'>
          {[...Array(5)].map((_, i) => (
            <div key={i} className='h-4 bg-gray-200 rounded dark:bg-gray-700' />
          ))}
        </div>
      </div>
    </>
  );
};

const ProfitTableData = ({ page, email, onPageChange }: ProfitTableProps) => {
  const { data } = useSuspenseQuery<PaginatedItem<ProfitData>>({
    queryKey: [...profitsQueryKey, page, email],
    queryFn: () => getProfitsAction({ page, email }),
    initialData: initialPaginatedState,
    refetchOnMount: 'always',
  });

  return <ProfitTableBase items={data} onPageChange={onPageChange} />;
};

export const ProfitTable = (props: ProfitTableProps) => {
  return (
    <Suspense fallback={<ProfitTableSkeleton />}>
      <ProfitTableData {...props} />
    </Suspense>
  );
};
