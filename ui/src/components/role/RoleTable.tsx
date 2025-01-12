'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useCallback } from 'react';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Table } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { PaginatedItem } from '@/interfaces/item.interface';
import { Role, initialPaginatedState } from '@/interfaces/role.interface';
import { formatYearDate } from '@/utils/date';

import { ColoredBadge } from '../common/ColoredBadge';
import { getRolesAction } from './action';

const rolesQueryKey = ['roles'];

export interface RoleTableProps {
  items: PaginatedItem<Role>;
}

const RoleTableBase = ({ items }: RoleTableProps) => {
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
        <h5 className='card-title text-dark dark:text-white mb-6'>{t('menu.roleManagement')}</h5>
      </div>
      <SimpleBar>
        <div className='overflow-x-auto'>
          <Table hoverable>
            <Table.Head className='dark:border-gray-800'>
              <Table.HeadCell className='whitespace-nowrap'>{t('role.name')}</Table.HeadCell>
              <Table.HeadCell className='whitespace-nowrap hidden lg:table-cell'>
                {t('role.description')}
              </Table.HeadCell>
              <Table.HeadCell className='whitespace-nowrap'>{t('role.permissions')}</Table.HeadCell>
              <Table.HeadCell className='whitespace-nowrap hidden lg:table-cell'>{t('createdAt')}</Table.HeadCell>
              <Table.HeadCell className='whitespace-nowrap'>{t('updatedAt')}</Table.HeadCell>
            </Table.Head>
            <Table.Body className='divide-y divide-border dark:divide-gray-800'>
              {items.items.map((role) => (
                <Table.Row
                  key={role.id}
                  className='hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                  onClick={() => router.push(`./roles/${role.id}`)}
                >
                  <Table.Cell className='whitespace-nowrap'>{role.name}</Table.Cell>
                  <Table.Cell className='whitespace-nowrap hidden lg:table-cell'>{role.description}</Table.Cell>
                  <Table.Cell className='whitespace-nowrap'>
                    <div className='flex flex-row flex-wrap gap-1 max-h-[48px] overflow-hidden relative'>
                      {role.permissions?.map((permission) => <ColoredBadge key={permission} text={permission} />)}
                      <div className='absolute bottom-0 right-0 left-0 h-6 bg-gradient-to-t from-white dark:from-gray-900'></div>
                    </div>
                  </Table.Cell>
                  <Table.Cell className='whitespace-nowrap hidden lg:table-cell'>
                    {formatYearDate(new Date(role.createdAt))}
                  </Table.Cell>
                  <Table.Cell className='whitespace-nowrap'>{formatYearDate(new Date(role.updatedAt))}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </SimpleBar>

      <div className='flex items-center justify-between mt-4 px-6 pb-6'>
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

const RoleTableSkeleton = () => {
  const t = useTranslations();

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-full break-words'>
      <div className='px-6'>
        <h5 className='card-title text-dark dark:text-white mb-6'>{t('menu.roleManagement')}</h5>
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

const RoleTableData = () => {
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = 10;

  const { data } = useSuspenseQuery<PaginatedItem<Role>>({
    queryKey: [...rolesQueryKey, page],
    queryFn: () => getRolesAction({ page, perPage }),
    initialData: initialPaginatedState,
    staleTime: 0,
  });

  return <RoleTableBase items={data} />;
};

export const RoleTable = () => {
  return (
    <Suspense fallback={<RoleTableSkeleton />}>
      <RoleTableData />
    </Suspense>
  );
};
