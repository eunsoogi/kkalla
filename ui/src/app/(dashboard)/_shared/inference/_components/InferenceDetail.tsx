'use client';
import React, { Fragment, Suspense, useCallback } from 'react';

import { Icon } from '@iconify/react/dist/iconify.js';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Badge } from 'flowbite-react';
import { useTranslations } from 'next-intl';

import { Category } from '@/enums/category.enum';
import { SortDirection } from '@/enums/sort.enum';
import { AllocationAuditBadge, AllocationRecommendation, MarketSignal } from '@/app/(dashboard)/_shared/inference/_types/inference.types';
import { CursorItem } from '@/shared/types/pagination.types';
import { formatDate } from '@/utils/date';

import { InfinityScroll } from '@/app/(dashboard)/_shared/infinite-scroll/InfinityScroll';
import { getAllocationRecommendationsCursorAction, getMarketSignalsCursorAction } from '../_actions/inference.actions';
import { getConfidenceColor, getValidationColor, getWeightColor } from '../inference.styles';

type Recommendation = MarketSignal | AllocationRecommendation;

interface InferenceDetailListContentProps {
  type: 'market' | 'allocation';
  symbol?: string;
  category?: Category;
  sortDirection: SortDirection;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Formats rate percent for the dashboard UI flow.
 * @param rate - Input value for rate.
 * @returns Formatted string output for the operation.
 */
const formatRatePercent = (rate?: number | null): string => {
  if (rate == null || !Number.isFinite(rate)) {
    return '-';
  }

  return `${Math.floor(rate * 100)}%`;
};

/**
 * Normalizes current ratio for the dashboard UI flow.
 * @param item - Input value for item.
 * @returns Computed numeric value for the operation.
 */
const resolveCurrentRatio = (item: AllocationRecommendation): number | null => {
  return Number.isFinite(item.modelTargetWeight) ? item.modelTargetWeight : null;
};

/**
 * Normalizes prev ratio for the dashboard UI flow.
 * @param item - Input value for item.
 * @returns Computed numeric value for the operation.
 */
const resolvePrevRatio = (item: AllocationRecommendation): number | null => {
  if (item.prevModelTargetWeight != null && Number.isFinite(item.prevModelTargetWeight)) {
    return item.prevModelTargetWeight;
  }

  return null;
};

/**
 * Retrieves validation label for the dashboard UI flow.
 * @param t - Input value for t.
 * @param badge - Input value for badge.
 * @returns Formatted string output for the operation.
 */
const getValidationLabel = (t: (key: string) => string, badge: AllocationAuditBadge): string => {
  if (badge.status === 'pending') return t('inference.validationPending');
  if (badge.status === 'running') return t('inference.validationRunning');
  if (badge.status === 'failed') return t('inference.validationFailed');
  if (badge.verdict === 'invalid') return t('inference.validationInvalid');
  if (badge.verdict === 'good') return t('inference.validationGood');
  if (badge.verdict === 'mixed') return t('inference.validationMixed');
  if (badge.verdict === 'bad') return t('inference.validationBad');
  return t('inference.validationCompleted');
};

/**
 * Formats market regime percent value for inference detail.
 * @param value - Input value for percent.
 * @returns Formatted string output for the operation.
 */
const formatMarketRegimePercent = (value?: number | null): string => {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }

  return `${value.toFixed(2)}%`;
};

/**
 * Formats market regime score value for inference detail.
 * @param value - Input value for score.
 * @returns Formatted string output for the operation.
 */
const formatMarketRegimeScore = (value: number | null | undefined, pointUnitLabel: string): string => {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }

  return `${Number(value.toFixed(2)).toString()}${pointUnitLabel}`;
};

/**
 * Formats feargreed score for inference detail.
 * @param value - Input value for score.
 * @returns Formatted string output for the operation.
 */
const formatFeargreedScore = (value?: number | null): string => {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }

  return value.toFixed(0);
};

/**
 * Formats market regime asOf for inference detail.
 * @param value - Input value for asOf.
 * @returns Formatted string output for the operation.
 */
const formatMarketRegimeAsOf = (value?: string | Date | null): string => {
  if (!value) {
    return '-';
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return formatDate(parsed);
};

/**
 * Renders the Inference Detail Item UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
const InferenceDetailItem: React.FC<InferenceDetailListContentProps> = ({ type, ...params }) => {
  const t = useTranslations();
  const pointUnitLabel = t('unitPoint');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<CursorItem<Recommendation>>({
    queryKey: ['inferences', type, 'cursor', params],
    queryFn: ({ pageParam = null }) => {
      const action = type === 'market' ? getMarketSignalsCursorAction : getAllocationRecommendationsCursorAction;
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
                <div className='relative'></div>
                <div className='p-6'>
                  <div className='flex flex-row justify-between items-start'>
                    <div className='flex flex-col gap-3'>
                      <h4 className='text-dark dark:text-white'>{item.symbol}</h4>
                      {type === 'allocation' ? (
                        <div className='flex items-center gap-2'>
                          {(() => {
                            const allocationItem = item as AllocationRecommendation;
                            const currentRatio = resolveCurrentRatio(allocationItem);
                            const prevRatio = resolvePrevRatio(allocationItem);
                            return (
                              <>
                                <span className='text-xs text-gray-600 dark:text-gray-400'>{t('inference.rate')}:</span>
                                <Badge style={getWeightColor(currentRatio ?? 0)}>
                                  {`${formatRatePercent(prevRatio)} -> ${formatRatePercent(currentRatio)}`}
                                </Badge>
                                {(allocationItem.validation24h ?? null) && (
                                  <div className='flex items-center gap-2'>
                                    <span className='text-xs text-gray-600 dark:text-gray-400'>
                                      {t('inference.validation24h')}:
                                    </span>
                                    <Badge
                                      style={getValidationColor(
                                        allocationItem.validation24h!.status,
                                        allocationItem.validation24h!.verdict,
                                      )}
                                    >
                                      {`${getValidationLabel(t, allocationItem.validation24h!)}${
                                        typeof allocationItem.validation24h?.overallScore === 'number'
                                          ? ` ${(allocationItem.validation24h.overallScore * 100).toFixed(0)}%`
                                          : ''
                                      }`}
                                    </Badge>
                                  </div>
                                )}
                                {(allocationItem.validation72h ?? null) && (
                                  <div className='flex items-center gap-2'>
                                    <span className='text-xs text-gray-600 dark:text-gray-400'>
                                      {t('inference.validation72h')}:
                                    </span>
                                    <Badge
                                      style={getValidationColor(
                                        allocationItem.validation72h!.status,
                                        allocationItem.validation72h!.verdict,
                                      )}
                                    >
                                      {`${getValidationLabel(t, allocationItem.validation72h!)}${
                                        typeof allocationItem.validation72h?.overallScore === 'number'
                                          ? ` ${(allocationItem.validation72h.overallScore * 100).toFixed(0)}%`
                                          : ''
                                      }`}
                                    </Badge>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className='flex items-center gap-4'>
                          <div className='flex items-center gap-2'>
                            <span className='text-xs text-gray-600 dark:text-gray-400'>{t('inference.weight')}:</span>
                            <Badge
                              style={getWeightColor((item as MarketSignal).weight)}
                            >{`${Math.floor((item as MarketSignal).weight * 100)}%`}</Badge>
                          </div>
                          <div className='flex items-center gap-2'>
                            <span className='text-xs text-gray-600 dark:text-gray-400'>
                              {t('inference.confidence')}:
                            </span>
                            <Badge
                              style={getConfidenceColor((item as MarketSignal).confidence)}
                            >{`${Math.floor((item as MarketSignal).confidence * 100)}%`}</Badge>
                          </div>
                          {(item as MarketSignal).validation24h && (
                            <div className='flex items-center gap-2'>
                              <span className='text-xs text-gray-600 dark:text-gray-400'>
                                {t('inference.validation24h')}:
                              </span>
                              <Badge
                                style={getValidationColor(
                                  (item as MarketSignal).validation24h!.status,
                                  (item as MarketSignal).validation24h!.verdict,
                                )}
                              >
                                {`${getValidationLabel(t, (item as MarketSignal).validation24h!)}${
                                  typeof (item as MarketSignal).validation24h?.overallScore === 'number'
                                    ? ` ${((item as MarketSignal).validation24h!.overallScore! * 100).toFixed(0)}%`
                                    : ''
                                }`}
                              </Badge>
                            </div>
                          )}
                          {(item as MarketSignal).validation72h && (
                            <div className='flex items-center gap-2'>
                              <span className='text-xs text-gray-600 dark:text-gray-400'>
                                {t('inference.validation72h')}:
                              </span>
                              <Badge
                                style={getValidationColor(
                                  (item as MarketSignal).validation72h!.status,
                                  (item as MarketSignal).validation72h!.verdict,
                                )}
                              >
                                {`${getValidationLabel(t, (item as MarketSignal).validation72h!)}${
                                  typeof (item as MarketSignal).validation72h?.overallScore === 'number'
                                    ? ` ${((item as MarketSignal).validation72h!.overallScore! * 100).toFixed(0)}%`
                                    : ''
                                }`}
                              </Badge>
                            </div>
                          )}
                        </div>
                      )}
                      <div className='flex flex-wrap items-center gap-2'>
                        <span className='text-xs text-gray-600 dark:text-gray-400'>{t('inference.marketRegime')}:</span>
                        <Badge color='gray'>
                          {`${t('inference.marketRegimeBtc')} ${formatMarketRegimePercent(item.btcDominance ?? null)}`}
                        </Badge>
                        <Badge color='gray'>
                          {`${t('inference.marketRegimeAlt')} ${formatMarketRegimeScore(item.altcoinIndex ?? null, pointUnitLabel)}`}
                        </Badge>
                        <Badge color='gray'>
                          {`${t('inference.marketRegimeFeargreed')} ${formatFeargreedScore(item.feargreedIndex ?? null)}`}
                        </Badge>
                        <Badge color='gray'>{`${t('inference.marketRegimeAsOf')} ${formatMarketRegimeAsOf(item.marketRegimeAsOf ?? null)}`}</Badge>
                        {item.marketRegimeIsStale === true && (
                          <Badge color='failure'>{t('inference.marketRegimeStale')}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className='text-gray-600 dark:text-gray-400 mt-4 whitespace-pre-wrap'>
                    <span className='font-medium text-gray-700 dark:text-gray-300'>{t('inference.reason')}:</span>{' '}
                    {item.reason && item.reason.trim().length > 0 ? item.reason : '-'}
                  </p>
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

/**
 * Renders the Inference Detail Skeleton UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
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
  type: 'market' | 'allocation';
  symbol?: string;
  category?: Category;
  decision?: string;
  sortDirection: SortDirection;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Renders the Inference Detail UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
export const InferenceDetail: React.FC<InferenceDetailProps> = ({
  type,
  symbol,
  category,
  sortDirection,
  startDate,
  endDate,
}) => {
  return (
    <Suspense fallback={<InferenceDetailSkeleton />}>
      <InferenceDetailItem
        type={type}
        symbol={symbol}
        category={category}
        sortDirection={sortDirection}
        startDate={startDate}
        endDate={endDate}
      />
    </Suspense>
  );
};
