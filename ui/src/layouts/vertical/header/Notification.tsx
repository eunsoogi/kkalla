'use client';

import React, { Fragment, Suspense, useCallback } from 'react';

import { Icon } from '@iconify/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Badge, Dropdown } from 'flowbite-react';
import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { CursorItem } from '@/interfaces/item.interface';
import { Notify } from '@/interfaces/notify.interface';
import { formatDate } from '@/utils/date';
import { ContentModal } from '@/components/dashboard/ContentModal';

import { getNotifyCursorAction } from './actions';

const MS_1H = 60 * 60 * 1000;
const NOTIFICATION_PREVIEW_ALLOWED_ELEMENTS = ['a', 'br', 'code', 'del', 'em', 'li', 'ol', 'p', 'strong', 'ul'] as const;

const NotificationContent: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const t = useTranslations();
  const [now] = React.useState(() => Date.now());
  const [openId, setOpenId] = React.useState<string | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } = useInfiniteQuery<CursorItem<Notify>>({
    queryKey: ['notify', 'cursor'],
    queryFn: ({ pageParam = null }) => getNotifyCursorAction(pageParam as string),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    enabled,
  });

  const handleLoad = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const selectedItem = openId ? items.find((item) => item.id === openId) : null;
  const isEmpty = items.length === 0 && !data?.pages.some((p) => p.items.length > 0);

  if (!enabled || isPending) {
    return (
      <div className='flex flex-col h-[min(70vh,420px)]'>
        <div className='shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-dark px-4 py-3'>
          <span className='text-sm font-semibold text-gray-800 dark:text-gray-200'>
            {t('dashboard.notificationLog')}
          </span>
        </div>
        <div className='min-h-0 flex-1 overflow-y-auto'>
          <NotificationSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-[min(70vh,420px)]'>
      <div className='shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-dark px-4 py-3'>
        <span className='text-sm font-semibold text-gray-800 dark:text-gray-200'>
          {t('dashboard.notificationLog')}
        </span>
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto'>
        {isEmpty ? (
          <div className='px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400'>
            {t('dashboard.emptyNotificationLog')}
          </div>
        ) : (
          data?.pages.map((page, i) => (
            <Fragment key={i}>
              {page.items.map((item) => (
                <NotificationItem key={item.id} now={now} onOpen={() => setOpenId(item.id)} {...item} />
              ))}
            </Fragment>
          ))
        )}
      </div>
      {hasNextPage && (
        <div className='shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-dark px-4 py-3'>
          <button
            type='button'
            onClick={handleLoad}
            disabled={isFetchingNextPage}
            className='cursor-pointer w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50'
          >
            {isFetchingNextPage ? t('loading') : t('more')}
          </button>
        </div>
      )}
      <ContentModal
        show={selectedItem !== null}
        onClose={() => setOpenId(null)}
        title={t('dashboard.columnMessage')}
        renderMarkdown
      >
        {selectedItem?.message ?? ''}
      </ContentModal>
    </div>
  );
};

const NotificationItem: React.FC<Notify & { now: number; onOpen: () => void }> = ({ now, onOpen, ...item }) => {
  const createdAt = new Date(item.createdAt).getTime();
  const isNew = now - createdAt <= MS_1H;

  return (
    <button
      type='button'
      onClick={onOpen}
      className='cursor-pointer flex w-full min-w-0 items-start gap-3 whitespace-normal px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors'
    >
      <span className='flex shrink-0 items-start pt-0.5 w-8 justify-center'>
        {isNew ? (
          <Icon icon='mdi:new-box' className='text-red-800 dark:text-red-600' height={20} width={20} />
        ) : (
          <Icon
            icon='solar:notification-unread-lines-outline'
            className='text-gray-400 dark:text-gray-500'
            height={20}
            width={20}
          />
        )}
      </span>
      <div className='min-w-0 flex-1'>
        <div className='line-clamp-2 break-words text-sm text-gray-800 dark:text-gray-200'>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            allowedElements={NOTIFICATION_PREVIEW_ALLOWED_ELEMENTS}
            unwrapDisallowed
            components={{
              p: ({ children }) => (
                <>
                  {children}{' '}
                </>
              ),
              ul: ({ children }) => (
                <>
                  {children}{' '}
                </>
              ),
              ol: ({ children }) => (
                <>
                  {children}{' '}
                </>
              ),
              li: ({ children }) => (
                <>
                  • {children}{' '}
                </>
              ),
              a: ({ children }) => <span className='underline decoration-dotted'>{children}</span>,
              code: ({ children }) => (
                <code className='rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800'>
                  {children}
                </code>
              ),
            }}
          >
            {item.message}
          </ReactMarkdown>
        </div>
        <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>{formatDate(new Date(item.createdAt))}</p>
      </div>
    </button>
  );
};

const NotificationSkeleton: React.FC = () => (
    <div className='space-y-0'>
      {[1, 2, 3].map((i) => (
        <div key={i} className='flex gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700'>
          <div className='h-5 w-5 shrink-0 rounded bg-gray-200 dark:bg-gray-700 animate-pulse' />
          <div className='min-w-0 flex-1 space-y-2'>
            <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full' />
            <div className='h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20' />
          </div>
        </div>
      ))}
    </div>
);

const notificationDropdownTheme = {
  floating: {
    base: 'z-10 w-96 max-w-[80vw] overflow-hidden border border-gray-200 dark:border-gray-700 shadow-lg dark:shadow-dark-md divide-y-0 rounded-xl focus:outline-none',
    style: {
      auto:
        'bg-white text-gray-900 dark:bg-dark dark:text-white dark:border-gray-700',
    },
  },
};

const Notification = () => {
  const t = useTranslations();
  const [enabled, setEnabled] = React.useState(false);

  const handleOpen = React.useCallback(() => {
    if (!enabled) {
      setEnabled(true);
    }
  }, [enabled]);

  return (
    <div className='relative group/menu'>
      <Dropdown
        label=''
        theme={notificationDropdownTheme}
        placement='bottom-end'
        dismissOnClick={false}
        renderTrigger={() => (
          <span
            className='h-10 w-10 hover:text-primary hover:bg-lightprimary rounded-full flex justify-center items-center cursor-pointer relative'
            aria-label='Notifications'
            onPointerDown={handleOpen}
            onFocus={handleOpen}
          >
            <Icon icon='solar:bell-linear' height={20} />
            <Badge className='h-2 w-2 rounded-full absolute end-2 top-1 bg-primary p-0' />
          </span>
        )}
      >
        <Suspense
          fallback={
            <div className='flex flex-col h-[min(70vh,420px)]'>
              <div className='shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-dark px-4 py-3'>
                <span className='text-sm font-semibold text-gray-800 dark:text-gray-200'>
                  {t('dashboard.notificationLog')}
                </span>
              </div>
              <div className='min-h-0 flex-1 overflow-y-auto'>
                <NotificationSkeleton />
              </div>
            </div>
          }
        >
          <NotificationContent enabled={enabled} />
        </Suspense>
      </Dropdown>
    </div>
  );
};

export default Notification;
