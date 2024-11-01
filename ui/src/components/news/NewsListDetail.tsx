'use client';

import React, { Suspense, useCallback } from 'react';

import { Icon } from '@iconify/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Badge } from 'flowbite-react';
import { TbPoint } from 'react-icons/tb';

import { GET } from '@/app/api/v1/news/cursor/route';
import { CursorItem } from '@/interfaces/item.interface';
import { News } from '@/interfaces/news.interface';
import { formatDate } from '@/utils/date';

import { InfinityScroll } from '../infinityscroll/InfinityScroll';
import { NEWS_STYLES } from './style';

const NewsContent = () => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<CursorItem<News>>({
    queryKey: ['news', 'cursor'],
    queryFn: ({ pageParam = null }) => GET(pageParam as string),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
  });

  const handleIntersect = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <InfinityScroll onIntersect={handleIntersect} isLoading={isFetchingNextPage} loadingText='뉴스 목록 로딩 중...'>
      <div className='space-y-4'>
        {data?.pages.map((page, i) => (
          <div key={i}>
            {page.items.map((item) => (
              <NewsItem key={item.id} {...item} />
            ))}
          </div>
        ))}
      </div>
    </InfinityScroll>
  );
};

const NewsItem = (item: News) => {
  const handleClick = useCallback(() => {
    window.open(item.link);
  }, [item]);

  return (
    <div
      className={`rounded-xl dark:shadow-dark-md shadow-md ${NEWS_STYLES[item.importance].bgStyle} transition-all cursor-pointer mb-30 p-0 relative w-full break-words`}
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
        <div className='flex'>
          <div className='flex items-center gap-2'>
            <span className={NEWS_STYLES[item.importance].textStyle}>{item.source}</span>
            {item.labels.map((label, i) => (
              <Badge key={i} color='muted' className='text-white bg-stone-600'>
                {label}
              </Badge>
            ))}
            {item.relatedStocks.map((stock, i) => (
              <Badge key={i} color='muted' className='text-white bg-stone-600'>
                {stock}
              </Badge>
            ))}
          </div>
          <div className='flex items-center ms-auto gap-1'>
            <TbPoint size={15} className={NEWS_STYLES[item.importance].textStyle} />
            <span className={`${NEWS_STYLES[item.importance].textStyle} text-sm`}>
              {formatDate(new Date(item.publishedAt))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const NewsSkeleton = () => {
  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray mb-30 p-0 relative w-full break-words overflow-hidden'>
      <div className='p-6'>
        <h2>뉴스 없음</h2>
        <div className='flex'>
          <div className='flex gap-1 items-center ms-auto'>
            <TbPoint size={15} className='text-dark' />
            <span className='text-sm text-darklink'>{formatDate(new Date())}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const NewsListDetail = () => {
  return (
    <Suspense fallback={<NewsSkeleton />}>
      <NewsContent />
    </Suspense>
  );
};

export default NewsListDetail;
