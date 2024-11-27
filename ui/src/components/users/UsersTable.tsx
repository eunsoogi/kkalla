'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useCallback } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Table } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { PaginatedItem } from '@/interfaces/item.interface';
import { User, initialPaginatedState } from '@/interfaces/user.interface';

import { getUsersAction } from './action';

const usersQueryKey = ['users'];

export interface UsersTableProps {
  items: PaginatedItem<User>;
}

const UsersTableBase = ({ items }: UsersTableProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams);
      params.set('page', newPage.toString());
      router.push(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-full break-words'>
      <div className='px-6'>
        <h5 className='card-title text-dark dark:text-white mb-6'>{t('menu.userManagement')}</h5>
      </div>
      <SimpleBar>
        <div className='overflow-x-auto'>
          <Table hoverable>
            <Table.Head className='dark:border-gray-800'>
              <Table.HeadCell className='whitespace-nowrap'>{t('user.email')}</Table.HeadCell>
              <Table.HeadCell className='whitespace-nowrap'>{t('user.role')}</Table.HeadCell>
              <Table.HeadCell className='whitespace-nowrap'>{t('createdAt')}</Table.HeadCell>
              <Table.HeadCell className='whitespace-nowrap'>{t('updatedAt')}</Table.HeadCell>
            </Table.Head>
            <Table.Body className='divide-y divide-border dark:divide-gray-800'>
              {items.items.map((user) => (
                <Table.Row key={user.id} className='hover:bg-gray-50 dark:hover:bg-gray-700'>
                  <Table.Cell className='whitespace-nowrap'>{user.email}</Table.Cell>
                  <Table.Cell className='whitespace-nowrap'>
                    {user.roles.map((role) => role.name).join(', ')}
                  </Table.Cell>
                  <Table.Cell className='whitespace-nowrap'>{new Date(user.createdAt).toLocaleString()}</Table.Cell>
                  <Table.Cell className='whitespace-nowrap'>{new Date(user.updatedAt).toLocaleString()}</Table.Cell>
                </Table.Row>
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

const UsersTableSkeleton = () => {
  const t = useTranslations();

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-full break-words'>
      <div className='px-6'>
        <h5 className='card-title text-dark dark:text-white mb-6'>{t('menu.userManagement')}</h5>
      </div>
      <SimpleBar>
        <div className='overflow-x-auto'>
          <Table hoverable>
            <Table.Body className='divide-y divide-border dark:divide-gray-800'>
              <Table.Row>
                <Table.Cell>{t('loading')}</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>
        </div>
      </SimpleBar>
    </div>
  );
};

const UsersTableData = () => {
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = 10;

  const { data } = useSuspenseQuery<PaginatedItem<User>>({
    queryKey: [...usersQueryKey, page],
    queryFn: () => getUsersAction({ page, perPage }),
    initialData: initialPaginatedState,
    staleTime: 0,
  });

  return <UsersTableBase items={data} />;
};

export const UsersTable = () => {
  return (
    <Suspense fallback={<UsersTableSkeleton />}>
      <UsersTableData />
    </Suspense>
  );
};
