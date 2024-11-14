'use client';

import Link from 'next/link';
import React, { Fragment, Suspense, useCallback } from 'react';

import { Icon } from '@iconify/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Badge, Button, Dropdown } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { CursorItem } from '@/interfaces/item.interface';
import { Notify } from '@/interfaces/notify.interface';
import { formatDate } from '@/utils/date';

import { getNotifyCursorAction } from './actions';

const NotificationContent: React.FC = () => {
  const t = useTranslations();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<CursorItem<Notify>>({
    queryKey: ['notify', 'cursor'],
    queryFn: ({ pageParam = null }) => getNotifyCursorAction(pageParam as string),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
  });

  const handleLoad = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <>
      {data?.pages.map((page, i) => (
        <Fragment key={i}>
          {page.items.map((item) => (
            <NotificationItem key={item.id} {...item} />
          ))}
        </Fragment>
      ))}
      <div className='flex flex-col p-3'>
        <Button
          onClick={handleLoad}
          disabled={isFetchingNextPage}
          size='sm'
          className='rounded-sm border border-secondary dark:border-lightsecondary bg-transparent text-secondary hover:text-white dark:hover:text-black hover:bg-secondary dark:text-lightsecondary dark:hover:bg-lightsecondary'
        >
          {t('more')}
        </Button>
      </div>
    </>
  );
};

const NotificationItem: React.FC<Notify> = (item: Notify) => {
  return (
    <Dropdown.Item
      as={Link}
      href='#'
      className='group/link w-full px-3 py-3 gap-3 bg-hover text-dark hover:bg-gray-100'
    >
      <div className='flex items-center gap-5'>
        <Icon
          icon='solar:notification-unread-lines-outline'
          height={35}
          className='text-secondary dark:text-lightsecondary'
        />
        <div className='flex flex-col'>
          <p className='text-sm font-semibold line-clamp-2'>{item.message}</p>
          <p className='text-xs'>{formatDate(new Date(item.createdAt))}</p>
        </div>
      </div>
    </Dropdown.Item>
  );
};

const NotificationSkeleton: React.FC = () => {
  const t = useTranslations();

  return (
    <Dropdown.Item
      as={Link}
      href='#'
      className='group/link w-full px-3 py-3 gap-3 bg-hover text-dark hover:bg-gray-100'
    >
      <div className='flex items-center gap-5'>
        <Icon
          icon='solar:notification-unread-lines-outline'
          height={35}
          className='text-secondary dark:text-lightsecondary'
        />
        <div className='flex flex-col'>
          <p className='text-sm font-semibold line-clamp-2'>{t('loading')}</p>
        </div>
      </div>
    </Dropdown.Item>
  );
};

const Notification = () => {
  return (
    <div className='relative group/menu'>
      <Dropdown
        label=''
        className='rounded-sm w-96 max-w-[80vw]'
        placement='bottom-end'
        dismissOnClick={false}
        renderTrigger={() => (
          <span
            className='h-10 w-10 hover:text-primary hover:bg-lightprimary rounded-full flex justify-center items-center cursor-pointer relative'
            aria-label='Notifications'
          >
            <Icon icon='solar:bell-linear' height={20} />
            <Badge className='h-2 w-2 rounded-full absolute end-2 top-1 bg-primary p-0' />
          </span>
        )}
      >
        <div className='max-h-[80vh] overflow-y-auto transform-none'>
          <Suspense fallback={<NotificationSkeleton />}>
            <NotificationContent />
          </Suspense>
        </div>
      </Dropdown>
    </div>
  );
};

export default Notification;
