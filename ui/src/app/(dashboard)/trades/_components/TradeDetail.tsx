'use client';
import React, { Fragment, Suspense, useCallback } from 'react';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Badge } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { SortDirection } from '@/enums/sort.enum';
import { TradeTypes } from '@/enums/trade.enum';
import { CursorItem } from '@/shared/types/pagination.types';
import { Trade } from '@/app/(dashboard)/_shared/trades/trade.types';
import { getDiffColor, getDiffPrefix } from '@/utils/color';
import { formatDate } from '@/utils/date';
import { formatNumber, formatRatePercent } from '@/utils/number';

import { InfinityScroll } from '@/app/(dashboard)/_shared/infinite-scroll/InfinityScroll';
import { getTradeCursorAction } from '../_actions/trade.actions';
import { TRADE_STYLES } from '@/app/(dashboard)/_shared/trades/trade.styles';

interface TradeDetailListContentProps {
  symbol?: string;
  type?: TradeTypes;
  sortDirection: SortDirection;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Renders the Trade Detail Item UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
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
      <div className='flex flex-col gap-x-4 gap-y-6 lg:gap-6 mt-6'>
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
                    <h4 className='text-dark dark:text-white'>{item.symbol}</h4>
                  </div>
                  <div className='flex flex-col mt-3 gap-2'>
                    <div className='flex justify-between'>
                      <span className='text-darklink'>{t('trade.type')}</span>
                      <Badge className={TRADE_STYLES[item.type].badgeStyle}>{t(`trade.types.${item.type}`)}</Badge>
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
                    <div className='flex justify-between'>
                      <span className='text-darklink'>{t('trade.executionMode')}</span>
                      <span className='text-dark dark:text-white'>
                        {item.executionMode ? t(`trade.executionModes.${item.executionMode}`) : '-'}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-darklink'>{t('trade.filledRatio')}</span>
                      <span className='text-dark dark:text-white'>{formatRatePercent(item.filledRatio, 2)}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-darklink'>{t('trade.orderStatus')}</span>
                      <span className='text-dark dark:text-white'>{item.orderStatus ?? '-'}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-darklink'>{t('trade.expectedEdgeRate')}</span>
                      <span className='text-dark dark:text-white'>{formatRatePercent(item.expectedEdgeRate, 2)}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-darklink'>{t('trade.estimatedCostRate')}</span>
                      <span className='text-dark dark:text-white'>
                        {formatRatePercent(item.estimatedCostRate, 2)}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-darklink'>{t('trade.spreadRate')}</span>
                      <span className='text-dark dark:text-white'>{formatRatePercent(item.spreadRate, 2)}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-darklink'>{t('trade.impactRate')}</span>
                      <span className='text-dark dark:text-white'>{formatRatePercent(item.impactRate, 2)}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-darklink'>{t('trade.triggerReason')}</span>
                      <span className='text-dark dark:text-white'>{item.triggerReason ?? '-'}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-darklink'>{t('trade.gateBypassedReason')}</span>
                      <span className='text-dark dark:text-white'>{item.gateBypassedReason ?? '-'}</span>
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
  symbol?: string;
  type?: TradeTypes;
  sortDirection: SortDirection;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Renders the Trade Detail UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
export const TradeDetail: React.FC<TradeDetailProps> = ({
  symbol,
  type,
  sortDirection = SortDirection.DESC,
  startDate,
  endDate,
}) => {
  return (
    <Suspense>
      <TradeDetailItem
        symbol={symbol}
        type={type}
        sortDirection={sortDirection}
        startDate={startDate}
        endDate={endDate}
      />
    </Suspense>
  );
};
