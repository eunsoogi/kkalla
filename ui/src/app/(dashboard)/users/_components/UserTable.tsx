'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { ColoredBadge } from '@/app/(dashboard)/_shared/ui/ColoredBadge';
import { PaginatedItem } from '@/shared/types/pagination.types';
import { User } from '@/app/(dashboard)/users/_types/user.types';
import { formatYearDate } from '@/utils/date';

import { getUsersAction } from '../_actions/user.actions';

const usersQueryKey = ['users'];

export interface UserTableProps {
  items: PaginatedItem<User>;
}

/**
 * Renders the User Table Base UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
const UserTableBase = ({ items }: UserTableProps) => {
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
            <TableHead className='dark:border-gray-800'>
              <TableRow>
                <TableHeadCell className='whitespace-nowrap'>{t('user.email')}</TableHeadCell>
                <TableHeadCell className='whitespace-nowrap'>{t('user.role')}</TableHeadCell>
                <TableHeadCell className='whitespace-nowrap hidden lg:table-cell'>{t('createdAt')}</TableHeadCell>
                <TableHeadCell className='whitespace-nowrap'>{t('updatedAt')}</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className='divide-y divide-border dark:divide-gray-800'>
              {items.items.map((user) => (
                <TableRow
                  key={user.id}
                  className='hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                  onClick={() => router.push(`./users/${user.id}`)}
                >
                  <TableCell className='whitespace-nowrap'>{user.email}</TableCell>
                  <TableCell className='whitespace-nowrap'>
                    <div className='flex flex-row flex-wrap gap-1 max-h-[48px] overflow-hidden relative'>
                      {user.roles.map((role) => (
                        <ColoredBadge key={role.name} text={role.name} />
                      ))}
                      <div className='absolute bottom-0 right-0 left-0 h-6 bg-gradient-to-t from-white dark:from-gray-900'></div>
                    </div>
                  </TableCell>
                  <TableCell className='whitespace-nowrap hidden lg:table-cell'>
                    {formatYearDate(new Date(user.createdAt))}
                  </TableCell>
                  <TableCell className='whitespace-nowrap'>{formatYearDate(new Date(user.updatedAt))}</TableCell>
                </TableRow>
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
                onClick={() => handlePageChange(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Renders the User Table Skeleton UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
const UserTableSkeleton = () => {
  const t = useTranslations();

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-full break-words'>
      <div className='px-6'>
        <h5 className='card-title text-dark dark:text-white mb-6'>{t('menu.userManagement')}</h5>
      </div>
      <SimpleBar>
        <div className='overflow-x-auto'>
          <Table hoverable>
            <TableBody className='divide-y divide-border dark:divide-gray-800'>
              <TableRow>
                <TableCell>{t('loading')}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </SimpleBar>
    </div>
  );
};

/**
 * Renders the User Table Data UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
const UserTableData = () => {
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = 10;

  const { data, isLoading } = useQuery<PaginatedItem<User>>({
    queryKey: [...usersQueryKey, page, perPage],
    queryFn: () => getUsersAction({ page, perPage }),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  if (isLoading || !data) {
    return <UserTableSkeleton />;
  }

  return <UserTableBase items={data} />;
};

/**
 * Renders the User Table UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
export const UserTable = () => {
  return <UserTableData />;
};
