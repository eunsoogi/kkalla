'use client';

import React from 'react';

import { useQuery } from '@tanstack/react-query';
import { Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { PaginatedItem } from '@/shared/types/pagination.types';
import { ProfitData } from '@/app/(dashboard)/_shared/profit/_types/profit.types';
import { getDiffColor, getDiffPrefix } from '@/utils/color';
import { formatNumber } from '@/utils/number';

import { getProfitsAction } from '../_actions/profit.actions';

const profitsQueryKey = ['profits'];

export interface ProfitTableProps {
  page: number;
  email?: string;
  onPageChange: (page: number) => void;
}

const ProfitTableItem = ({ email, profit }: ProfitData) => {
  return (
    <TableRow>
      <TableCell className='whitespace-nowrap'>{email}</TableCell>
      <TableCell className={`whitespace-nowrap ${getDiffColor(profit)}`}>
        {getDiffPrefix(profit)}
        {formatNumber(profit)}
      </TableCell>
    </TableRow>
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
            <TableHead className='dark:border-gray-800'>
              <TableRow>
                <TableHeadCell className='whitespace-nowrap'>{t('user.email')}</TableHeadCell>
                <TableHeadCell className='whitespace-nowrap'>{t('trade.profit')}</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className='divide-y divide-border dark:divide-gray-800'>
              {items.items.map((profit) => (
                <ProfitTableItem key={profit.email} {...profit} />
              ))}
            </TableBody>
          </Table>
        </div>
      </SimpleBar>
      <div className='mt-4 flex flex-col gap-3 px-6 pb-6 sm:flex-row sm:items-center sm:justify-between'>
        <div className='text-sm text-gray-700 dark:text-gray-300'>
          {t('pagination', {
            start: (items.page - 1) * (items.perPage ?? 1) + 1,
            end: Math.min(items.page * (items.perPage ?? 1), items.total),
            total: items.total,
          })}
        </div>
        <div className='w-full overflow-x-auto sm:w-auto'>
          <div className='flex w-max gap-2 sm:justify-end'>
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
  const { data, isLoading } = useQuery<PaginatedItem<ProfitData>>({
    queryKey: [...profitsQueryKey, page, email],
    queryFn: () => getProfitsAction({ page, email }),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  if (isLoading || !data) {
    return <ProfitTableSkeleton />;
  }

  return <ProfitTableBase items={data} onPageChange={onPageChange} />;
};

export const ProfitTable = (props: ProfitTableProps) => {
  return <ProfitTableData {...props} />;
};
