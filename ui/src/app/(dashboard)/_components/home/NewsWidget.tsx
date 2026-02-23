'use client';

import React from 'react';

import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import SimpleBar from 'simplebar-react';

import { News } from '@/app/(dashboard)/_shared/news/news.types';
import { formatDate } from '@/utils/date';

import { NEWS_STYLES } from '@/app/(dashboard)/_shared/news/news.styles';

import { ContentModal } from '@/app/(dashboard)/_shared/ui/ContentModal';

const MS_1H = 60 * 60 * 1000;

export const NewsWidgetSkeleton = () => (
  <div className='animate-pulse px-4 py-6 space-y-3'>
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4' />
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6' />
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3' />
  </div>
);

interface NewsWidgetProps {
  items?: News[];
  isLoading?: boolean;
}

export function NewsWidget({ items = [], isLoading = false }: NewsWidgetProps) {
  const t = useTranslations();
  const router = useRouter();
  const [now] = React.useState(() => Date.now());
  const [openId, setOpenId] = React.useState<string | null>(null);

  if (isLoading) {
    return (
      <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0 overflow-hidden'>
        <div className='px-4 sm:px-6 flex items-center justify-between mb-4'>
          <h5 className='card-title text-dark dark:text-white'>{t('dashboard.news')}</h5>
          <button
            type='button'
            onClick={() => router.push('/news')}
            className='cursor-pointer text-sm text-primary-600 hover:underline dark:text-primary-400 py-2 px-1 min-h-[44px] min-w-[44px] flex items-center justify-end'
          >
            {t('dashboard.viewAll')}
          </button>
        </div>
        <NewsWidgetSkeleton />
      </div>
    );
  }

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0 overflow-hidden'>
      <div className='px-4 sm:px-6 flex items-center justify-between mb-4'>
        <h5 className='card-title text-dark dark:text-white'>{t('dashboard.news')}</h5>
        <button
          type='button'
          onClick={() => router.push('/news')}
          className='cursor-pointer text-sm text-primary-600 hover:underline dark:text-primary-400 py-2 px-1 min-h-[44px] min-w-[44px] flex items-center justify-end'
        >
          {t('dashboard.viewAll')}
        </button>
      </div>
      {items.length === 0 ? (
        <div className='py-6 text-center text-gray-500 dark:text-gray-400 text-sm'>
          {t('dashboard.emptyNews')}
        </div>
      ) : (
        <SimpleBar className='min-h-0'>
          <div className='overflow-x-auto min-w-0'>
            <Table hoverable className='w-full text-left'>
              <TableHead className='text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700'>
                <TableRow>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap w-0' />
                  <TableHeadCell className='px-4 py-3'>{t('dashboard.columnTitle')}</TableHeadCell>
                  <TableHeadCell className='px-4 py-3 whitespace-nowrap w-[100px]'>{t('dashboard.columnTime')}</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {items.map((item) => {
                  const style = NEWS_STYLES[item.importance ?? 0];
                  const published = new Date(item.publishedAt).getTime();
                  const isNew = now - published <= MS_1H;
                  return (
                    <TableRow
                      key={item.id}
                      role='button'
                      tabIndex={0}
                      className={`cursor-pointer border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 ${style.bgStyle}`}
                      onClick={() => setOpenId(item.id)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpenId(item.id)}
                    >
                      <TableCell className='px-4 py-3 w-0 align-top'>
                        <div className='flex items-center gap-1'>
                          <Icon
                            icon='ic:sharp-notification-important'
                            className={`${style.iconStyle} shrink-0`}
                            height={18}
                          />
                          {isNew && (
                            <Icon icon='mdi:new-box' className='shrink-0 text-red-800 dark:text-red-600' height={24} width={24} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className='px-4 py-3 text-sm min-w-0'>
                        <p
                          className={`font-medium wrap-break-word ${style.textStyle}`}
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {item.title}
                        </p>
                        <p className={`mt-0.5 text-xs ${style.textStyle} opacity-80`}>{item.source}</p>
                      </TableCell>
                      <TableCell className='px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap'>
                        {formatDate(new Date(item.publishedAt))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </SimpleBar>
      )}
      {items.map((item) => (
        <ContentModal
          key={item.id}
          show={openId === item.id}
          onClose={() => setOpenId(null)}
          title={t('dashboard.columnTitle')}
          actionLink={item.link}
        >
          {item.title}
        </ContentModal>
      ))}
    </div>
  );
}
