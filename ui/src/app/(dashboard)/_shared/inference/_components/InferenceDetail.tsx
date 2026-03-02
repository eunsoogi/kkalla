'use client';
import React, { Suspense, useCallback, useMemo, useState } from 'react';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { MetricRow } from '@/app/(dashboard)/_shared/report-ui/MetricRow';
import { DetailMetricGrid } from '@/app/(dashboard)/_shared/report-ui/DetailMetricGrid';
import { ReportDetailPane } from '@/app/(dashboard)/_shared/report-ui/ReportDetailPane';
import { ReportListPane } from '@/app/(dashboard)/_shared/report-ui/ReportListPane';
import { ReportMasterDetailLayout } from '@/app/(dashboard)/_shared/report-ui/ReportMasterDetailLayout';
import { StatusPill } from '@/app/(dashboard)/_shared/report-ui/StatusPill';
import type { ReportMetricItem } from '@/app/(dashboard)/_shared/report-ui/report-ui.types';
import { InfinityScroll } from '@/app/(dashboard)/_shared/infinite-scroll/InfinityScroll';
import {
  AllocationAuditBadge,
  AllocationRecommendation,
  MarketSignal,
} from '@/app/(dashboard)/_shared/inference/_types/inference.types';
import { CursorItem } from '@/shared/types/pagination.types';
import { formatDate } from '@/utils/date';
import { formatPercent } from '@/utils/number';
import { getValidationTone } from '@/utils/status-tone';

import type {
  AllocationDetailPanelProps,
  AllocationListItemProps,
  InferenceDetailEmptyProps,
  InferenceDetailListContentProps,
  InferenceDetailProps,
  MarketDetailPanelProps,
  MarketListItemProps,
  Recommendation,
  Translator,
} from './inference-detail.types';
import { getAllocationRecommendationsCursorAction, getMarketSignalsCursorAction } from '../_actions/inference.actions';
import { getConfidenceColor, getWeightColor } from '../inference.styles';

/**
 * Normalizes current ratio for allocation recommendation.
 * @param item - Allocation recommendation row.
 * @returns Ratio value or null.
 */
const resolveCurrentRatio = (item: AllocationRecommendation): number | null => {
  return Number.isFinite(item.modelTargetWeight) ? item.modelTargetWeight : null;
};

/**
 * Normalizes previous ratio for allocation recommendation.
 * @param item - Allocation recommendation row.
 * @returns Ratio value or null.
 */
const resolvePrevRatio = (item: AllocationRecommendation): number | null => {
  if (item.prevModelTargetWeight != null && Number.isFinite(item.prevModelTargetWeight)) {
    return item.prevModelTargetWeight;
  }

  return null;
};

/**
 * Retrieves validation label.
 * @param t - Translator.
 * @param badge - Validation badge data.
 * @returns Localized label.
 */
const getValidationLabel = (t: Translator, badge: AllocationAuditBadge): string => {
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
 * Formats validation text.
 * @param t - Translator.
 * @param badge - Validation badge data.
 * @returns Display text.
 */
const formatValidationText = (t: Translator, badge?: AllocationAuditBadge | null): string => {
  if (!badge) {
    return '-';
  }

  const label = getValidationLabel(t, badge);
  if (typeof badge.overallScore === 'number') {
    return `${label} ${(badge.overallScore * 100).toFixed(0)}%`;
  }

  return label;
};

/**
 * Formats market regime percent.
 * @param value - Percent value.
 * @returns Formatted output.
 */
const formatMarketRegimePercent = (value?: number | null): string => {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }

  return `${value.toFixed(2)}%`;
};

/**
 * Formats market regime score.
 * @param value - Score value.
 * @param pointUnitLabel - Unit label.
 * @returns Formatted output.
 */
const formatMarketRegimeScore = (value: number | null | undefined, pointUnitLabel: string): string => {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }

  return `${Number(value.toFixed(2)).toString()}${pointUnitLabel}`;
};

/**
 * Formats fear-greed score.
 * @param value - Score value.
 * @param pointUnitLabel - Unit label.
 * @returns Formatted output.
 */
const formatFeargreedScore = (value: number | null | undefined, pointUnitLabel: string): string => {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }

  return `${value.toFixed(0)}${pointUnitLabel}`;
};

/**
 * Formats market regime timestamp.
 * @param value - Timestamp value.
 * @returns Formatted output.
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

const getRegimeStaleLabel = (t: Translator): string => t('report.exception.regimeStale');

/**
 * Renders inference detail empty state.
 * @param params - Empty state props.
 * @returns Rendered React element.
 */
const InferenceDetailEmpty: React.FC<InferenceDetailEmptyProps> = ({ t }) => {
  return (
    <div className='flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 text-sm text-gray-500 shadow-sm dark:border-gray-600 dark:bg-dark dark:text-gray-400'>
      {t('report.empty.selectItem')}
    </div>
  );
};

const InferenceDetailSection: React.FC<{ title: string; titleRight?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  titleRight,
  children,
}) => {
  return (
    <section className='space-y-2'>
      <div className='flex items-center justify-between gap-2'>
        <p className='text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'>{title}</p>
        {titleRight}
      </div>
      {children}
    </section>
  );
};

/**
 * Renders market list item.
 * @param params - Market list item props.
 * @returns Rendered React element.
 */
const MarketListItem: React.FC<MarketListItemProps> = ({ item, t, isSelected, onSelect }) => {
  const summaryMetrics: ReportMetricItem[] = [
    {
      key: 'confidence',
      label: t('inference.confidence'),
      value: formatPercent(item.confidence, 2),
      tone: 'neutral',
      style: getConfidenceColor(item.confidence),
    },
    {
      key: 'weight',
      label: t('inference.weight'),
      value: formatPercent(item.weight, 2),
      tone: 'neutral',
      style: getWeightColor(item.weight),
    },
  ];

  return (
    <button
      type='button'
      aria-selected={isSelected}
      onClick={() => onSelect(item.id)}
      className={`w-full cursor-pointer rounded-lg border p-3 text-left transition ${
        isSelected
          ? 'border-[var(--color-report-tab-active-border)] bg-[var(--color-report-tab-active-bg)]'
          : 'border-gray-200 bg-white hover:border-[var(--color-report-tab-active-border)] dark:border-gray-700 dark:bg-dark'
      }`}
    >
      <div className='flex items-start justify-between gap-3'>
        <h4 className='text-base font-semibold text-dark dark:text-white'>{item.symbol}</h4>
        <span className='text-sm text-gray-500 dark:text-gray-400'>
          {item.createdAt ? formatDate(new Date(item.createdAt)) : '-'}
        </span>
      </div>

      <div className='mt-2'>
        <MetricRow items={summaryMetrics} />
      </div>
    </button>
  );
};

/**
 * Renders allocation list item.
 * @param params - Allocation list item props.
 * @returns Rendered React element.
 */
const AllocationListItem: React.FC<AllocationListItemProps> = ({ item, t, isSelected, onSelect }) => {
  const currentRatio = resolveCurrentRatio(item);
  const prevRatio = resolvePrevRatio(item);

  const summaryMetrics: ReportMetricItem[] = [
    {
      key: 'ratio',
      label: t('inference.rate'),
      value: `${formatPercent(prevRatio)} -> ${formatPercent(currentRatio)}`,
      tone: 'neutral',
      style: getWeightColor(currentRatio ?? 0),
    },
    {
      key: 'decisionConfidence',
      label: t('inference.confidence'),
      value: formatPercent(item.decisionConfidence ?? null, 2),
      tone: 'neutral',
      style: getConfidenceColor(item.decisionConfidence ?? 0),
    },
    {
      key: 'expectedVolatilityPct',
      label: t('inference.expectedVolatilityPct'),
      value: formatPercent(item.expectedVolatilityPct ?? null, 2),
      tone: 'neutral',
      style: getWeightColor(item.expectedVolatilityPct ?? 0),
    },
  ];

  return (
    <button
      type='button'
      aria-selected={isSelected}
      onClick={() => onSelect(item.id)}
      className={`w-full cursor-pointer rounded-lg border p-3 text-left transition ${
        isSelected
          ? 'border-[var(--color-report-tab-active-border)] bg-[var(--color-report-tab-active-bg)]'
          : 'border-gray-200 bg-white hover:border-[var(--color-report-tab-active-border)] dark:border-gray-700 dark:bg-dark'
      }`}
    >
      <div className='flex items-start justify-between gap-3'>
        <h4 className='text-base font-semibold text-dark dark:text-white'>{item.symbol}</h4>
        <span className='text-sm text-gray-500 dark:text-gray-400'>
          {item.createdAt ? formatDate(new Date(item.createdAt)) : '-'}
        </span>
      </div>

      <div className='mt-2'>
        <MetricRow items={summaryMetrics} />
      </div>
    </button>
  );
};

/**
 * Renders market detail panel.
 * @param params - Market detail props.
 * @returns Rendered React element.
 */
const MarketDetailPanel: React.FC<MarketDetailPanelProps> = ({ item, t, pointUnitLabel }) => {
  const summaryMetrics: ReportMetricItem[] = [
    {
      key: 'confidence',
      label: t('inference.confidence'),
      value: formatPercent(item.confidence, 2),
      tone: 'neutral',
      style: getConfidenceColor(item.confidence),
    },
    {
      key: 'weight',
      label: t('inference.weight'),
      value: formatPercent(item.weight, 2),
      tone: 'neutral',
      style: getWeightColor(item.weight),
    },
  ];

  const validationMetrics: ReportMetricItem[] = [
    {
      key: 'validation24h',
      label: t('inference.validation24h'),
      value: formatValidationText(t, item.validation24h),
      tone: getValidationTone(item.validation24h?.status, item.validation24h?.verdict ?? null),
    },
    {
      key: 'validation72h',
      label: t('inference.validation72h'),
      value: formatValidationText(t, item.validation72h),
      tone: getValidationTone(item.validation72h?.status, item.validation72h?.verdict ?? null),
    },
  ];

  const regimeMetrics: ReportMetricItem[] = [
    {
      key: 'btcDominance',
      label: t('inference.marketRegimeBtc'),
      value: formatMarketRegimePercent(item.btcDominance ?? null),
      tone: 'neutral',
    },
    {
      key: 'altcoinIndex',
      label: t('inference.marketRegimeAlt'),
      value: formatMarketRegimeScore(item.altcoinIndex ?? null, pointUnitLabel),
      tone: 'neutral',
    },
    {
      key: 'feargreed',
      label: t('inference.marketRegimeFeargreed'),
      value: formatFeargreedScore(item.feargreedIndex ?? null, pointUnitLabel),
      tone: 'neutral',
    },
    {
      key: 'asOf',
      label: t('inference.marketRegimeAsOf'),
      value: formatMarketRegimeAsOf(item.marketRegimeAsOf ?? null),
      tone: 'neutral',
    },
  ];

  const staleMessage = item.marketRegimeIsStale ? getRegimeStaleLabel(t) : null;

  return (
    <ReportDetailPane
      title={item.symbol}
      createdAtLabel={t('createdAt')}
      createdAtValue={item.createdAt ? formatDate(new Date(item.createdAt)) : '-'}
      headerMetrics={summaryMetrics}
    >
      <div className='space-y-5'>
        <InferenceDetailSection title={t('report.section.reason')}>
          <p className='whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300'>{item.reason?.trim() || '-'}</p>
        </InferenceDetailSection>
        <InferenceDetailSection title={t('report.section.validation')}>
          <DetailMetricGrid items={validationMetrics} />
        </InferenceDetailSection>
        <InferenceDetailSection title={t('report.section.regime')}>
          <div className='space-y-3'>
            <DetailMetricGrid items={regimeMetrics} />
            {staleMessage ? (
              <p className='text-sm font-medium text-amber-600 dark:text-amber-300'>{staleMessage}</p>
            ) : null}
          </div>
        </InferenceDetailSection>
      </div>
    </ReportDetailPane>
  );
};

/**
 * Renders allocation detail panel.
 * @param params - Allocation detail props.
 * @returns Rendered React element.
 */
const AllocationDetailPanel: React.FC<AllocationDetailPanelProps> = ({ item, t, pointUnitLabel }) => {
  const currentRatio = resolveCurrentRatio(item);
  const prevRatio = resolvePrevRatio(item);
  const riskFlagList = (item.riskFlags ?? [])
    .map((flag) => (typeof flag === 'string' ? flag.trim() : ''))
    .filter((flag) => flag.length > 0);

  const headerMetrics: ReportMetricItem[] = [
    {
      key: 'ratio',
      label: t('inference.rate'),
      value: `${formatPercent(prevRatio)} -> ${formatPercent(currentRatio)}`,
      tone: 'neutral',
      style: getWeightColor(currentRatio ?? 0),
    },
    {
      key: 'decisionConfidence',
      label: t('inference.confidence'),
      value: formatPercent(item.decisionConfidence ?? null, 2),
      tone: 'neutral',
      style: getConfidenceColor(item.decisionConfidence ?? 0),
    },
    {
      key: 'expectedVolatilityPct',
      label: t('inference.expectedVolatilityPct'),
      value: formatPercent(item.expectedVolatilityPct ?? null, 2),
      tone: 'neutral',
      style: getWeightColor(item.expectedVolatilityPct ?? 0),
    },
  ];

  const validationMetrics: ReportMetricItem[] = [
    {
      key: 'validation24h',
      label: t('inference.validation24h'),
      value: formatValidationText(t, item.validation24h),
      tone: getValidationTone(item.validation24h?.status, item.validation24h?.verdict ?? null),
    },
    {
      key: 'validation72h',
      label: t('inference.validation72h'),
      value: formatValidationText(t, item.validation72h),
      tone: getValidationTone(item.validation72h?.status, item.validation72h?.verdict ?? null),
    },
  ];

  const costMetrics: ReportMetricItem[] = [
    {
      key: 'expectedEdgeRate',
      label: t('inference.expectedEdgeRate'),
      value: formatPercent(item.expectedEdgeRate ?? null, 2),
      tone: 'neutral',
    },
    {
      key: 'estimatedCostRate',
      label: t('inference.estimatedCostRate'),
      value: formatPercent(item.estimatedCostRate ?? null, 2),
      tone: 'neutral',
    },
    {
      key: 'spreadRate',
      label: t('inference.spreadRate'),
      value: formatPercent(item.spreadRate ?? null, 2),
      tone: 'neutral',
    },
    {
      key: 'impactRate',
      label: t('inference.impactRate'),
      value: formatPercent(item.impactRate ?? null, 2),
      tone: 'neutral',
    },
  ];

  const regimeMetrics: ReportMetricItem[] = [
    {
      key: 'btcDominance',
      label: t('inference.marketRegimeBtc'),
      value: formatMarketRegimePercent(item.btcDominance ?? null),
      tone: 'neutral',
    },
    {
      key: 'altcoinIndex',
      label: t('inference.marketRegimeAlt'),
      value: formatMarketRegimeScore(item.altcoinIndex ?? null, pointUnitLabel),
      tone: 'neutral',
    },
    {
      key: 'feargreed',
      label: t('inference.marketRegimeFeargreed'),
      value: formatFeargreedScore(item.feargreedIndex ?? null, pointUnitLabel),
      tone: 'neutral',
    },
    {
      key: 'asOf',
      label: t('inference.marketRegimeAsOf'),
      value: formatMarketRegimeAsOf(item.marketRegimeAsOf ?? null),
      tone: 'neutral',
    },
  ];

  const regimeStale = item.marketRegimeIsStale === true;

  return (
    <ReportDetailPane
      title={item.symbol}
      createdAtLabel={t('createdAt')}
      createdAtValue={item.createdAt ? formatDate(new Date(item.createdAt)) : '-'}
      headerMetrics={headerMetrics}
    >
      <div className='space-y-5'>
        <InferenceDetailSection title={t('inference.riskFlags')}>
          {riskFlagList.length > 0 ? (
            <ul className='list-disc space-y-1 pl-5 text-sm leading-6 text-gray-600 dark:text-gray-300'>
              {riskFlagList.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
          ) : (
            <p className='text-sm leading-6 text-gray-500 dark:text-gray-400'>-</p>
          )}
        </InferenceDetailSection>
        <InferenceDetailSection title={t('report.section.reason')}>
          <p className='whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300'>{item.reason?.trim() || '-'}</p>
        </InferenceDetailSection>
        <InferenceDetailSection title={t('report.section.validation')}>
          <DetailMetricGrid items={validationMetrics} />
        </InferenceDetailSection>
        <InferenceDetailSection title={t('report.section.cost')}>
          <DetailMetricGrid items={costMetrics} />
        </InferenceDetailSection>
        <InferenceDetailSection
          title={t('report.section.regime')}
          titleRight={regimeStale ? <StatusPill value={t('inference.marketRegimeStale')} tone='warning' /> : undefined}
        >
          <div className='space-y-3'>
            <DetailMetricGrid items={regimeMetrics} />
          </div>
        </InferenceDetailSection>
      </div>
    </ReportDetailPane>
  );
};

/**
 * Renders inference detail list content.
 * @param params - Input params.
 * @returns Rendered React element.
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

  const items = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? [];
  }, [data?.pages]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailTargetId, setMobileDetailTargetId] = useState<string | null>(null);

  const selectedItem = useMemo(() => {
    if (items.length === 0) {
      return null;
    }

    if (!selectedId) {
      return items[0];
    }

    return items.find((item) => item.id === selectedId) ?? items[0];
  }, [items, selectedId]);

  const handleIntersect = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleSelect = (id: string) => {
    setSelectedId(id);

    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
      setMobileDetailTargetId(id);
    }
  };

  const selectedItemId = selectedItem?.id ?? null;

  const listPane = (
    <ReportListPane>
      {items.length === 0 ? (
        <p className='py-10 text-center text-sm text-gray-500 dark:text-gray-400'>{t('nothing')}</p>
      ) : (
        <InfinityScroll onIntersect={handleIntersect} isLoading={isFetchingNextPage} loadingText={t('loading')}>
          <div className='flex flex-col gap-3'>
            {items.map((item) =>
              type === 'allocation' ? (
                <AllocationListItem
                  key={item.id}
                  item={item as AllocationRecommendation}
                  t={t}
                  isSelected={item.id === selectedItemId}
                  onSelect={handleSelect}
                />
              ) : (
                <MarketListItem
                  key={item.id}
                  item={item as MarketSignal}
                  t={t}
                  isSelected={item.id === selectedItemId}
                  onSelect={handleSelect}
                />
              ),
            )}
          </div>
        </InfinityScroll>
      )}
    </ReportListPane>
  );

  const detailPane = !selectedItem ? (
    <InferenceDetailEmpty t={t} />
  ) : type === 'allocation' ? (
    <AllocationDetailPanel
      item={selectedItem as AllocationRecommendation}
      t={t}
      pointUnitLabel={pointUnitLabel}
    />
  ) : (
    <MarketDetailPanel
      item={selectedItem as MarketSignal}
      t={t}
      pointUnitLabel={pointUnitLabel}
    />
  );

  return (
    <ReportMasterDetailLayout
      listPane={listPane}
      detailPane={detailPane}
      mobileDetailOpen={selectedItem != null && mobileDetailTargetId === selectedItem.id}
      mobileDetailTitle={selectedItem?.symbol ?? t('report.empty.selectItem')}
      onMobileDetailClose={() => setMobileDetailTargetId(null)}
    />
  );
};

/**
 * Renders the inference detail skeleton.
 * @returns Rendered React element.
 */
export const InferenceDetailSkeleton: React.FC = () => {
  return (
    <div className='animate-pulse rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-dark'>
      <div className='mb-4 h-4 w-1/4 rounded bg-gray-200 dark:bg-gray-700'></div>
      <div className='h-20 rounded bg-gray-200 dark:bg-gray-700'></div>
      <div className='mt-4 flex justify-end'>
        <div className='h-4 w-24 rounded bg-gray-200 dark:bg-gray-700'></div>
      </div>
    </div>
  );
};

/**
 * Renders inference detail page body.
 * @param params - Input values.
 * @returns Rendered React element.
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
