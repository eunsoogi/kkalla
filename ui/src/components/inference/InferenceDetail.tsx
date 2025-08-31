'use client';

import React, { Fragment, Suspense, useCallback } from 'react';

import { Icon } from '@iconify/react/dist/iconify.js';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Badge } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { Category } from '@/enums/category.enum';
import { SortDirection } from '@/enums/sort.enum';
import { BalanceRecommendation, MarketRecommendation } from '@/interfaces/inference.interface';
import { CursorItem } from '@/interfaces/item.interface';
import { formatDate } from '@/utils/date';

import { CopyLinkButton } from '../common/CopyLinkButton';
import { InfinityScroll } from '../infinityscroll/InfinityScroll';
import { getBalanceRecommendationsCursorAction, getMarketRecommendationsCursorAction } from './action';
import { getConfidenceColor, getRateColor, getWeightColor } from './style';

type Recommendation = MarketRecommendation | BalanceRecommendation;

interface InferenceDetailListContentProps {
  type: 'market' | 'balance';
  ticker?: string;
  category?: Category;
  sortDirection: SortDirection;
  startDate?: Date;
  endDate?: Date;
}

const InferenceDetailItem: React.FC<InferenceDetailListContentProps> = ({ type, ...params }) => {
  const t = useTranslations();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<CursorItem<Recommendation>>({
    queryKey: ['inferences', type, 'cursor', params],
    queryFn: ({ pageParam = null }) => {
      const action = type === 'market' ? getMarketRecommendationsCursorAction : getBalanceRecommendationsCursorAction;
      return action({
        cursor: pageParam as string,
        ...params,
      }) as Promise<CursorItem<Recommendation>>;
    },
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
              <div
                key={item.id}
                className={`
                  rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark
                  relative w-full break-words
                `}
              >
                <div className='relative'>
                </div>
                <div className='p-6'>
                  <div className='flex flex-row gap-6 items-center'>
                    {'ticker' in item ? (
                      <>
                        <h4 className='text-dark dark:text-white'>{item.ticker}</h4>
                        <Badge style={getRateColor(item.rate)}>{`${t('inference.rate')}: ${Math.floor(item.rate * 100)}%`}</Badge>
                      </>
                    ) : (
                      <>
                        <h4 className='text-dark dark:text-white'>{item.symbol}</h4>
                        <Badge style={getWeightColor(item.weight)}>{`${t('inference.weight')}: ${Math.floor(item.weight * 100)}%`}</Badge>
                        <Badge style={getConfidenceColor(item.confidence)}>{`${t('inference.confidence')}: ${Math.floor(item.confidence * 100)}%`}</Badge>
                      </>
                    )}
                    <div className='ml-auto'>
                      <CopyLinkButton path={`/inferences/${item.id}`} />
                    </div>
                  </div>
                  {'reason' in item && type === 'market' && (
                    <p className='text-gray-600 dark:text-gray-400 mt-4'>{item.reason}</p>
                  )}
                  <div className='flex mt-3'>
                    <div className='flex gap-1 items-center ms-auto'>
                      <Icon icon='mdi:circle-small' className='text-darklink' width={20} height={20} />
                      <time className='text-sm text-darklink'>
                        {item.createdAt && formatDate(new Date(item.createdAt))}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </InfinityScroll>
  );
};

export const InferenceDetailSkeleton: React.FC = () => {
  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark relative w-full break-words animate-pulse'>
      <div className='p-6'>
        <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4'></div>
        <div className='h-20 bg-gray-200 dark:bg-gray-700 rounded'></div>
        <div className='flex justify-end mt-4'>
          <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-24'></div>
        </div>
      </div>
    </div>
  );
};

interface InferenceDetailProps {
  type: 'market' | 'balance';
  ticker?: string;
  category?: Category;
  decision?: string;
  sortDirection: SortDirection;
  startDate?: Date;
  endDate?: Date;
}

export const InferenceDetail: React.FC<InferenceDetailProps> = ({
  type,
  ticker,
  category,
  sortDirection,
  startDate,
  endDate,
}) => {
  return (
    <Suspense fallback={<InferenceDetailSkeleton />}>
      <InferenceDetailItem
        type={type}
        ticker={ticker}
        category={category}
        sortDirection={sortDirection}
        startDate={startDate}
        endDate={endDate}
      />
    </Suspense>
  );
};
