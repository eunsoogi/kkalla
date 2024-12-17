'use client';

import React, { Fragment, Suspense, useCallback } from 'react';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Badge } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { SortDirection } from '@/enums/sort.enum';
import { TradeTypes } from '@/enums/trade.enum';
import { CursorItem } from '@/interfaces/item.interface';
import { Trade } from '@/interfaces/trade.interface';
import { getDiffColor, getDiffPrefix } from '@/utils/color';
import { formatDate } from '@/utils/date';
import { formatNumber } from '@/utils/number';

import { InfinityScroll } from '../infinityscroll/InfinityScroll';
import { getTradeCursorAction } from './action';
import { TRADE_STYLES } from './style';

interface TradeDetailListContentProps {
  ticker?: string;
  type?: TradeTypes;
  sortDirection: SortDirection;
  startDate?: Date;
  endDate?: Date;
}

const TradeDetailItem: React.FC<TradeDetailListContentProps> = (params) => {
  const t = useTranslations();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<CursorItem<Trade>>({
    queryKey: ['trades', 'cursor', params],
    queryFn: ({ pageParam = null }) =>
      getTradeCursorAction({
        cursor: pageParam as string,
        ...params,
      }),
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
                <div className='p-6'>
                  <div className='flex flex-row gap-6 items-center'>
                    <h4 className='text-dark dark:text-white'>{item.ticker}</h4>
                  </div>
                  <div className='flex flex-col mt-3 gap-2'>
                    <div className='flex justify-between'>
                      <span className='text-darklink'>{t('trade.type')}</span>
                      <Badge className={TRADE_STYLES[item.type].badgeStyle}>{item.type}</Badge>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-darklink'>{t('trade.amount')}</span>
                      <span className='text-dark dark:text-white'>{formatNumber(item.amount)}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-darklink'>{t('trade.profit')}</span>
                      <span className={getDiffColor(item.profit)}>
                        {getDiffPrefix(item.profit)}
                        {formatNumber(item.profit)}
                      </span>
                    </div>
                  </div>
                  <div className='flex mt-3'>
                    <div className='flex gap-1 items-center ms-auto'>
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

interface TradeDetailProps {
  ticker?: string;
  type?: TradeTypes;
  sortDirection: SortDirection;
  startDate?: Date;
  endDate?: Date;
}

export const TradeDetail: React.FC<TradeDetailProps> = ({
  ticker,
  type,
  sortDirection = SortDirection.DESC,
  startDate,
  endDate,
}) => {
  return (
    <Suspense>
      <TradeDetailItem
        ticker={ticker}
        type={type}
        sortDirection={sortDirection}
        startDate={startDate}
        endDate={endDate}
      />
    </Suspense>
  );
};
