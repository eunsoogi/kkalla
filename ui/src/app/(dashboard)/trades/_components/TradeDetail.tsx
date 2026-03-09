'use client';
import React, { Suspense, useCallback, useMemo, useState } from 'react';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { SortDirection } from '@/enums/sort.enum';
import { DetailMetricGrid } from '@/app/(dashboard)/_shared/report-ui/DetailMetricGrid';
import { ReportDetailPane } from '@/app/(dashboard)/_shared/report-ui/ReportDetailPane';
import { ReportListPane } from '@/app/(dashboard)/_shared/report-ui/ReportListPane';
import { ReportMasterDetailLayout } from '@/app/(dashboard)/_shared/report-ui/ReportMasterDetailLayout';
import type { ReportMetricItem } from '@/app/(dashboard)/_shared/report-ui/report-ui.types';
import { StatusPill } from '@/app/(dashboard)/_shared/report-ui/StatusPill';
import { buildTradeExplanation } from '@/app/(dashboard)/_shared/trades/trade-presentation';
import { TradeTypeText } from '@/app/(dashboard)/_shared/trades/TradeTypeText';
import { InfinityScroll } from '@/app/(dashboard)/_shared/infinite-scroll/InfinityScroll';
import { Trade } from '@/app/(dashboard)/_shared/trades/trade.types';
import { CursorItem } from '@/shared/types/pagination.types';
import { getDeltaColor, getDeltaPrefix } from '@/utils/color';
import { formatDate } from '@/utils/date';
import { formatNumber } from '@/utils/number';

import type {
  TradeDetailEmptyProps,
  TradeDetailListContentProps,
  TradeDetailPanelProps,
  TradeDetailProps,
  TradeListItemProps,
} from './trade-detail.types';
import { getTradeCursorAction } from '../_actions/trade.actions';

/**
 * Formats numeric value with sign.
 * @param value - Input value.
 * @returns Signed text.
 */
const formatSignedNumber = (value: number): string => {
  return `${getDeltaPrefix(value)}${formatNumber(value)}`;
};

/**
 * Builds signed metric style while preserving legacy red/blue meaning.
 * @param value - Signed value.
 * @returns CSS style object.
 */
const getSignedMetricStyle = (value: number): React.CSSProperties => {
  return {
    backgroundColor: 'transparent',
    borderColor: 'var(--color-report-neutral-border)',
    color: value > 0 ? '#ef4444' : value < 0 ? '#3b82f6' : 'var(--color-report-neutral-fg)',
  };
};

/**
 * Renders trade detail empty state.
 * @param params - Empty state props.
 * @returns Rendered React element.
 */
const TradeDetailEmpty: React.FC<TradeDetailEmptyProps> = ({ t }) => {
  return (
    <div className='flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 text-sm text-gray-500 shadow-sm dark:border-gray-600 dark:bg-dark dark:text-gray-400'>
      {t('report.empty.selectItem')}
    </div>
  );
};

const TradeDetailSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className='space-y-2'>
    <p className='text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'>{title}</p>
    {children}
  </section>
);

/**
 * Renders trade list item.
 * @param params - Trade list item props.
 * @returns Rendered React element.
 */
const TradeListItemCard: React.FC<TradeListItemProps> = ({ item, t, isSelected, onSelect }) => {
  const tradeTypeLabel = t(`trade.types.${item.type}`);
  const explanation = buildTradeExplanation(item, t);

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
        <div className='flex items-center gap-2'>
          <TradeTypeText type={item.type} label={tradeTypeLabel} />
          <h4 className='text-base font-semibold text-dark dark:text-white'>{item.symbol}</h4>
        </div>
        <span className='text-sm text-gray-500 dark:text-gray-400'>{formatDate(new Date(item.createdAt))}</span>
      </div>

      <div className='mt-2 flex items-center justify-between gap-3'>
        <span className='text-sm text-gray-500 dark:text-gray-400'>
          {t('trade.amount')}: {formatNumber(item.amount)}
        </span>
        <span className={`text-sm font-semibold ${getDeltaColor(item.profit)}`}>
          {formatSignedNumber(item.profit)}
        </span>
      </div>
      {explanation.triageCue ? (
        <div className='mt-3'>
          <StatusPill value={explanation.triageCue} tone='neutral' />
        </div>
      ) : null}
    </button>
  );
};

/**
 * Renders trade detail panel.
 * @param params - Trade detail panel props.
 * @returns Rendered React element.
 */
const TradeDetailPanel: React.FC<TradeDetailPanelProps> = ({ item, t }) => {
  const tradeTypeLabel = t(`trade.types.${item.type}`);
  const explanation = buildTradeExplanation(item, t);

  const costMetrics: ReportMetricItem[] = [
    ...explanation.costReviewRows.map((row) => ({
      key: row.key,
      label: row.label,
      value: row.value,
      tone: 'neutral' as const,
    })),
  ];

  const headerMetrics: ReportMetricItem[] = [
    {
      key: 'amount',
      label: t('trade.amount'),
      value: formatNumber(item.amount),
      tone: 'neutral',
    },
    {
      key: 'profit',
      label: t('trade.profit'),
      value: formatSignedNumber(item.profit),
      tone: 'neutral',
      style: getSignedMetricStyle(item.profit),
    },
  ];

  return (
    <ReportDetailPane
      title={item.symbol}
      titleAddon={<TradeTypeText type={item.type} label={tradeTypeLabel} />}
      createdAtLabel={t('createdAt')}
      createdAtValue={formatDate(new Date(item.createdAt))}
      headerMetrics={headerMetrics}
    >
      <div className='space-y-5'>
        <TradeDetailSection title={t('trade.detail.sections.decisionSummary')}>
          <DetailMetricGrid
            items={explanation.decisionSummaryRows.map((row) => ({
              key: row.key,
              label: row.label,
              value: row.value,
              tone: 'neutral' as const,
            }))}
          />
        </TradeDetailSection>
        <TradeDetailSection title={t('trade.detail.sections.executionLimits')}>
          <DetailMetricGrid
            items={explanation.executionLimitRows.map((row) => ({
              key: row.key,
              label: row.label,
              value: row.value,
              tone: 'neutral' as const,
            }))}
          />
        </TradeDetailSection>
        <TradeDetailSection title={t('trade.detail.sections.costReview')}>
          <DetailMetricGrid items={costMetrics} />
        </TradeDetailSection>
        <TradeDetailSection title={t('trade.detail.sections.modeFallbacks')}>
          <DetailMetricGrid
            items={explanation.modeFallbackRows.map((row) => ({
              key: row.key,
              label: row.label,
              value: row.value,
              tone: 'neutral' as const,
            }))}
          />
        </TradeDetailSection>
      </div>
    </ReportDetailPane>
  );
};

/**
 * Renders trade detail list content.
 * @param params - Input values.
 * @returns Rendered React element.
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
            {items.map((item) => (
              <TradeListItemCard
                key={item.id}
                item={item}
                t={t}
                isSelected={item.id === selectedItemId}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </InfinityScroll>
      )}
    </ReportListPane>
  );

  const detailPane = selectedItem ? <TradeDetailPanel item={selectedItem} t={t} /> : <TradeDetailEmpty t={t} />;

  return (
    <ReportMasterDetailLayout
      listPane={listPane}
      detailPane={detailPane}
      mobileDetailOpen={selectedItem != null && mobileDetailTargetId === selectedItem.id}
      mobileDetailTitle={
        selectedItem ? (
          <span className='inline-flex items-center gap-2'>
            <TradeTypeText type={selectedItem.type} label={t(`trade.types.${selectedItem.type}`)} />
            <span className='text-sm font-semibold text-dark dark:text-white'>{selectedItem.symbol}</span>
          </span>
        ) : (
          t('report.empty.selectItem')
        )
      }
      mobileDetailAriaLabel={selectedItem ? `${t(`trade.types.${selectedItem.type}`)} ${selectedItem.symbol}` : t('report.empty.selectItem')}
      onMobileDetailClose={() => setMobileDetailTargetId(null)}
    />
  );
};

/**
 * Renders trade detail page.
 * @param params - Input values.
 * @returns Rendered React element.
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
