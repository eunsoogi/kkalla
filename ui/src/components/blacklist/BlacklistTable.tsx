'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Table } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { ColoredBadge } from '@/components/common/ColoredBadge';
import { Blacklist } from '@/interfaces/blacklist.interface';
import { PaginatedItem } from '@/interfaces/item.interface';
import { getCategoryText } from '@/utils/category';
import { formatYearDate } from '@/utils/date';

import { getBlacklistsAction } from './action';

export interface BlacklistTableProps {
  items: PaginatedItem<Blacklist>;
}

const BlacklistTableSkeleton = () => {
  const t = useTranslations();

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-full break-words'>
      <div className='px-6'>
        <h5 className='card-title text-dark dark:text-white mb-6'>{t('menu.blacklistManagement')}</h5>
      </div>
      <SimpleBar>
        <div className='overflow-x-auto'>
          <Table hoverable>
            <Table.Head className='dark:border-gray-800'>
              <Table.HeadCell className='whitespace-nowrap'>{t('ticker')}</Table.HeadCell>
              <Table.HeadCell className='whitespace-nowrap'>{t('category.label')}</Table.HeadCell>
              <Table.HeadCell className='whitespace-nowrap hidden lg:table-cell'>{t('createdAt')}</Table.HeadCell>
              <Table.HeadCell className='whitespace-nowrap'>{t('updatedAt')}</Table.HeadCell>
            </Table.Head>
            <Table.Body className='divide-y divide-border dark:divide-gray-800'>
              {[...Array(5)].map((_, index) => (
                <Table.Row key={index} className='hover:bg-gray-50 dark:hover:bg-gray-700'>
                  <Table.Cell className='whitespace-nowrap'>
                    <div className='h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
                  </Table.Cell>
                  <Table.Cell className='whitespace-nowrap'>
                    <div className='h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
                  </Table.Cell>
                  <Table.Cell className='whitespace-nowrap hidden lg:table-cell'>
                    <div className='h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
                  </Table.Cell>
                  <Table.Cell className='whitespace-nowrap'>
                    <div className='h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </SimpleBar>
    </div>
  );
};

const BlacklistTableContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();

  const page = Number(searchParams.get('page')) || 1;
  const perPage = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['blacklists', page, perPage],
    queryFn: () => getBlacklistsAction({ page, perPage }),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams);
      params.set('page', newPage.toString());
      router.push(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  if (isLoading || !data) {
    return <BlacklistTableSkeleton />;
  }

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-full break-words'>
      <div className='px-6'>
        <h5 className='card-title text-dark dark:text-white mb-6'>{t('menu.blacklistManagement')}</h5>
      </div>
      <SimpleBar>
        <div className='overflow-x-auto'>
          <Table hoverable>
            <Table.Head className='dark:border-gray-800'>
              <Table.HeadCell className='whitespace-nowrap'>{t('ticker')}</Table.HeadCell>
              <Table.HeadCell className='whitespace-nowrap'>{t('category.label')}</Table.HeadCell>
              <Table.HeadCell className='whitespace-nowrap hidden lg:table-cell'>{t('createdAt')}</Table.HeadCell>
              <Table.HeadCell className='whitespace-nowrap'>{t('updatedAt')}</Table.HeadCell>
            </Table.Head>
            <Table.Body className='divide-y divide-border dark:divide-gray-800'>
              {data.items.map((blacklist) => (
                <Table.Row
                  key={blacklist.id}
                  className='hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                  onClick={() => router.push(`./blacklists/${blacklist.id}`)}
                >
                  <Table.Cell className='whitespace-nowrap'>{blacklist.ticker}</Table.Cell>
                  <Table.Cell className='whitespace-nowrap'>
                    <ColoredBadge text={getCategoryText(blacklist.category, t)} />
                  </Table.Cell>
                  <Table.Cell className='whitespace-nowrap hidden lg:table-cell'>
                    {formatYearDate(new Date(blacklist.createdAt))}
                  </Table.Cell>
                  <Table.Cell className='whitespace-nowrap'>{formatYearDate(new Date(blacklist.updatedAt))}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </SimpleBar>

      <div className='flex items-center justify-between mt-4 px-6 pb-6'>
        <div className='text-sm text-gray-700 dark:text-gray-300'>
          {t('pagination', {
            start: (data.page - 1) * (data.perPage ?? 1) + 1,
            end: Math.min(data.page * (data.perPage ?? 1), data.total),
            total: data.total,
          })}
        </div>
        <div className='flex space-x-2'>
          {Array.from({ length: data.totalPages }, (_, i) => (
            <button
              key={i + 1}
              className={`px-3 py-1 text-sm rounded ${
                data.page === i + 1
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
              onClick={() => handlePageChange(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const BlacklistTable = () => {
  return <BlacklistTableContent />;
};
