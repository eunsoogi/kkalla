'use client';

import Image from 'next/image';
import React, { Fragment, Suspense, useCallback } from 'react';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Badge } from 'flowbite-react';
import { TbPoint } from 'react-icons/tb';

import { Inference } from '@/interfaces/inference.interface';
import { CursorItem } from '@/interfaces/item.interface';
import { formatDate } from '@/utils/date';

import { InfinityScroll } from '../infinityscroll/InfinityScroll';
import { getInferenceCursorAction } from './action';
import { DECISION_STYLES } from './style';
import userImage from '/public/images/profile/user-1.jpg';

const InferenceContent: React.FC<{ id?: string }> = ({ id }) => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<CursorItem<Inference>>({
    queryKey: ['inferences', 'cursor'],
    queryFn: ({ pageParam = null }) => getInferenceCursorAction(pageParam as string),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
  });

  const handleIntersect = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <InfinityScroll onIntersect={handleIntersect} isLoading={isFetchingNextPage} loadingText='추론 목록 로딩 중...'>
      <div className='flex flex-col gap-4 lg:gap-30'>
        {data?.pages.map((page, i) => (
          <Fragment key={i}>
            {page.items.map((item) => (
              <InferenceItem key={item.id} {...item} isFocus={item.id == id} />
            ))}
          </Fragment>
        ))}
      </div>
    </InfinityScroll>
  );
};

const InferenceItem: React.FC<Inference & { isFocus: boolean }> = ({ isFocus = false, ...item }) => {
  return (
    <div
      className={`${isFocus && 'border-2 border-primary'} rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray relative w-full break-words`}
    >
      <div className='relative'>
        <Image
          src={userImage}
          className='h-10 w-10 rounded-full absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
          alt='user'
        />
      </div>
      <div className='p-6'>
        <div className='flex gap-6 mt-6'>
          <Badge color='muted' className={DECISION_STYLES[item.decision].badgeStyle}>
            {item.decision}
          </Badge>
          <h4>{item.rate * 100}%</h4>
        </div>
        <div className='grid grid-cols-12 lg:gap-x-30'>
          <div className='lg:col-span-6 col-span-12'>
            <h4 className='my-3'>추론 내용</h4>
            <div className='my-3'>{item.reason}</div>
          </div>
          <div className='lg:col-span-6 col-span-12'>
            <h4 className='my-3'>회귀 내용</h4>
            <div className='my-3'>{item.reflection}</div>
          </div>
        </div>
        <div className='flex'>
          <div className='flex gap-1 items-center ms-auto'>
            <TbPoint size={15} className='text-dark' />
            <span className='text-sm text-darklink'>{formatDate(new Date(item.createdAt))}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const InferenceSkeleton: React.FC = () => {
  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray relative w-full break-words'>
      <div className='p-6'>
        <div className='grid grid-cols-12 gap-x-4 lg:gap-x-30'>
          <div className='lg:col-span-6 col-span-12'>
            <h4 className='my-3'>추론 내용</h4>
            <div className='my-3 lg:line-clamp-4'>없음</div>
          </div>
          <div className='lg:col-span-6 col-span-12'>
            <h4 className='my-3'>회귀 내용</h4>
            <div className='my-3 lg:line-clamp-4'>없음</div>
          </div>
        </div>
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

const InferenceListDetail: React.FC<{ id?: string }> = ({ id }) => {
  return (
    <Suspense fallback={<InferenceSkeleton />}>
      <InferenceContent id={id} />
    </Suspense>
  );
};

export default InferenceListDetail;
