'use client';

import React, { Fragment, Suspense } from 'react';

import { useInfiniteQuery } from '@tanstack/react-query';

import { Inference } from '@/interfaces/inference.interface';
import { CursorItem } from '@/interfaces/item.interface';

import { InferenceDetailItem, InferenceDetailSkeleton } from './InferenceDetailItem';
import { getInferenceCursorAction } from './action';

const InferenceDetailContent: React.FC<{ id?: string }> = ({ id }) => {
  const { data } = useInfiniteQuery<CursorItem<Inference>>({
    queryKey: ['inferences', 'cursor', id],
    queryFn: ({ pageParam = null }) => getInferenceCursorAction({ cursor: pageParam as string, limit: 1, skip: false }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: id,
  });

  return (
    <div className='flex flex-col gap-x-4 gap-y-30 lg:gap-30 mt-30'>
      {data?.pages.map((page, i) => (
        <Fragment key={i}>
          {page.items.map((item) => (
            <InferenceDetailItem key={item.id} {...item} isFocus={item.id == id} />
          ))}
        </Fragment>
      ))}
    </div>
  );
};

export const InferenceDetail: React.FC<{ id?: string }> = ({ id }) => {
  return (
    <Suspense fallback={<InferenceDetailSkeleton />}>
      <InferenceDetailContent id={id} />
    </Suspense>
  );
};
