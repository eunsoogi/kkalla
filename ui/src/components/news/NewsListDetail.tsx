'use client';

import React, { Fragment, Suspense, useCallback } from 'react';

import { Icon } from '@iconify/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Badge } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { CursorItem } from '@/interfaces/item.interface';
import { News } from '@/interfaces/news.interface';
import { formatDate } from '@/utils/date';

import { InfinityScroll } from '../infinityscroll/InfinityScroll';
import { getNewsAction } from './action';
import { NEWS_STYLES } from './style';

const NewsContent: React.FC<{ id?: string }> = ({ id }) => {
  const t = useTranslations();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<CursorItem<News>>({
    queryKey: ['news', 'cursor'],
    queryFn: ({ pageParam = null }) => getNewsAction(pageParam as string),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
  });

  const handleIntersect = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <InfinityScroll onIntersect={handleIntersect} isLoading={isFetchingNextPage} loadingText={t('loading')}>
      <div className='flex flex-col gap-4 lg:gap-6'>
        {data?.pages.map((page, i) => (
          <Fragment key={i}>
            {page.items.map((item) => (
              <NewsItem key={item.id} {...item} isFocus={item.id == id} />
            ))}
          </Fragment>
        ))}
      </div>
    </InfinityScroll>
  );
};

const NewsItem: React.FC<News & { isFocus?: boolean }> = ({ isFocus = false, ...item }) => {
  const handleClick = useCallback(() => {
    window.open(item.link);
  }, [item]);

  return (
    <div
      className={`${isFocus ? 'border-2 border-primary' : ''} rounded-xl dark:shadow-dark-md shadow-md ${NEWS_STYLES[item.importance].bgStyle} transition-all cursor-pointer relative w-full break-words`}
      onClick={handleClick}
    >
      <div className='p-6'>
        <div className='flex items-center gap-6 mb-2'>
          <Icon
            icon='ic:sharp-notification-important'
            className={`${NEWS_STYLES[item.importance].iconStyle} flex-shrink-0`}
            height={30}
          />
          <h2 className={NEWS_STYLES[item.importance].textStyle}>{item.title}</h2>
        </div>
        <div className='flex items-start gap-2 mb-2'>
          <span className={NEWS_STYLES[item.importance].textStyle}>{item.source}</span>
          <div className='flex items-center ms-auto gap-1'>
            <Icon icon='mdi:circle-small' className='text-darklink' width={20} height={20} />
            <span className={`${NEWS_STYLES[item.importance].textStyle} text-sm`}>
              {formatDate(new Date(item.publishedAt))}
            </span>
          </div>
        </div>
        <div className='flex flex-row flex-wrap gap-2'>
          {item.labels.map((label, i) => (
            <Badge key={i} color='muted' className='text-white bg-stone-600'>
              {label}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
};

const NewsSkeleton: React.FC = () => {
  const t = useTranslations();

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark p-0 relative w-full break-words overflow-hidden'>
      <div className='p-6'>
        <h2>{t('nothing')}</h2>
        <div className='flex'>
          <div className='flex gap-1 items-center ms-auto'>
            <Icon icon='mdi:circle-small' className='text-darklink' width={20} height={20} />
            <span className='text-sm text-darklink'>{formatDate(new Date())}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const NewsListDetail: React.FC<{ id?: string }> = ({ id }) => {
  return (
    <Suspense fallback={<NewsSkeleton />}>
      <NewsContent id={id} />
    </Suspense>
  );
};

export default NewsListDetail;
