'use client';

import React from 'react';

import { Icon } from '@iconify/react';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { formatDate } from '@/utils/date';

import { getNotifyLogAction } from './action';

const MS_1H = 60 * 60 * 1000;

export const NotificationLogTableSkeleton = () => (
  <div className='animate-pulse px-4 py-6 space-y-3'>
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4' />
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-full' />
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4' />
  </div>
);

export function NotificationLogTable() {
  const t = useTranslations();
  const [now] = React.useState(() => Date.now());
  const { data, isPending } = useQuery({
    queryKey: ['dashboard', 'notify-log'],
    queryFn: () => getNotifyLogAction(1, 10),
    refetchOnMount: 'always',
  });

  if (isPending) {
    return (
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0 overflow-hidden'>
        <div className='px-4 sm:px-6'>
          <h5 className='card-title text-dark dark:text-white mb-4'>{t('dashboard.notificationLog')}</h5>
        </div>
        <NotificationLogTableSkeleton />
      </div>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0 overflow-hidden'>
        <div className='px-4 sm:px-6'>
          <h5 className='card-title text-dark dark:text-white mb-4'>{t('dashboard.notificationLog')}</h5>
        </div>
        <div className='px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm'>
          {t('dashboard.emptyNotificationLog')}
        </div>
      </div>
    );
  }

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0 overflow-hidden'>
      <div className='px-4 sm:px-6'>
        <h5 className='card-title text-dark dark:text-white mb-4'>{t('dashboard.notificationLog')}</h5>
      </div>
      <SimpleBar className='min-h-0'>
        <div className='overflow-x-auto min-w-0'>
          <Table hoverable className='w-full text-left table-fixed min-w-0'>
            <TableHead className='text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700 sticky top-0'>
              <TableRow>
                <TableHeadCell className='px-2 sm:px-4 py-3 whitespace-nowrap w-[72px] sm:w-[120px]'>
                  {t('dashboard.columnTime')}
                </TableHeadCell>
                <TableHeadCell className='px-4 py-3 min-w-0'>
                  {t('dashboard.columnMessage')}
                </TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody className='divide-y divide-gray-200 dark:divide-gray-700'>
              {items.map((item) => {
                const createdAt = new Date(item.createdAt).getTime();
                const isNew = now - createdAt <= MS_1H;
                return (
                  <TableRow
                    key={item.id}
                    className='border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  >
                    <TableCell className='px-2 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 w-[72px] sm:w-[120px]'>
                      <div className='flex items-center gap-1'>
                        {isNew && (
                          <Icon
                            icon='mdi:new-box'
                            className='shrink-0 text-red-800 dark:text-red-600'
                            height={24}
                            width={24}
                          />
                        )}
                        <span>{formatDate(new Date(item.createdAt))}</span>
                      </div>
                    </TableCell>
                    <TableCell className='px-4 py-3 text-sm text-dark dark:text-white break-words min-w-0'>
                      {item.message}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </SimpleBar>
    </div>
  );
}
