'use client';

import React, { Fragment, Suspense, useCallback } from 'react';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Inference } from '@/interfaces/inference.interface';
import { CursorItem } from '@/interfaces/item.interface';

import { InfinityScroll } from '../infinityscroll/InfinityScroll';
import { InferenceDetailItem, InferenceDetailSkeleton } from './InferenceDetailItem';
import { getInferenceCursorAction } from './action';

interface InferenceDetailListContentProps {
  mine: boolean;
}

const InferenceDetailListContent: React.FC<InferenceDetailListContentProps> = ({ mine }) => {
  const t = useTranslations();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<CursorItem<Inference>>({
    queryKey: ['inferences', 'cursor', mine],
    queryFn: ({ pageParam = null }) => getInferenceCursorAction({ cursor: pageParam as string, mine }),
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
      <div className='flex flex-col gap-x-4 gap-y-30 lg:gap-30 mt-30'>
        {data?.pages.map((page, i) => (
          <Fragment key={i}>
            {page.items.map((item) => (
              <InferenceDetailItem key={item.id} {...item} isFocus={false} />
            ))}
          </Fragment>
        ))}
      </div>
    </InfinityScroll>
  );
};

interface InferenceDetailListProps {
  mine: boolean;
}

export const InferenceDetailList: React.FC<InferenceDetailListProps> = ({ mine }) => {
  return (
    <Suspense fallback={<InferenceDetailSkeleton />}>
      <InferenceDetailListContent mine={mine} />
    </Suspense>
  );
};
