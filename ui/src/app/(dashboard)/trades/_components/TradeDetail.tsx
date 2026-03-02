'use client';
import React, { Suspense, useCallback, useMemo, useState } from 'react';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { SortDirection } from '@/enums/sort.enum';
import { DetailMetricGrid } from '@/app/(dashboard)/_shared/report-ui/DetailMetricGrid';
import { ExceptionChips } from '@/app/(dashboard)/_shared/report-ui/ExceptionChips';
import { ReportDetailPane } from '@/app/(dashboard)/_shared/report-ui/ReportDetailPane';
import { ReportListPane } from '@/app/(dashboard)/_shared/report-ui/ReportListPane';
import { StatusPill } from '@/app/(dashboard)/_shared/report-ui/StatusPill';
import { ReportMasterDetailLayout } from '@/app/(dashboard)/_shared/report-ui/ReportMasterDetailLayout';
import type { ExceptionChipViewItem } from '@/app/(dashboard)/_shared/report-ui/report-master-detail.types';
import type { ReportMetricItem } from '@/app/(dashboard)/_shared/report-ui/report-ui.types';
import { TradeTypeText } from '@/app/(dashboard)/_shared/trades/TradeTypeText';
import { InfinityScroll } from '@/app/(dashboard)/_shared/infinite-scroll/InfinityScroll';
import { Trade } from '@/app/(dashboard)/_shared/trades/trade.types';
import { CursorItem } from '@/shared/types/pagination.types';
import { getDiffColor, getDiffPrefix } from '@/utils/color';
import { formatDate } from '@/utils/date';
import { formatNumber, formatPercent } from '@/utils/number';
import { resolveExceptionChipTypes } from '@/utils/report-priority';
import type { ExceptionChipType } from '@/utils/report-priority.types';
import { getExceptionTone } from '@/utils/status-tone';
import { resolveGateBypassedReasonLabel, resolveOrderStatusLabel, resolveTriggerReasonLabel } from '@/utils/trade-label';

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
  return `${getDiffPrefix(value)}${formatNumber(value)}`;
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
 * Resolves localized exception label.
 * @param t - Translator.
 * @param type - Exception type.
 * @returns Localized label.
 */
const getExceptionLabel = (t: (key: string) => string, type: ExceptionChipType): string => {
  if (type === 'validationFailed') return t('report.exception.validationFailed');
  if (type === 'validationRunning') return t('report.exception.validationRunning');
  if (type === 'regimeStale') return t('report.exception.regimeStale');
  if (type === 'risk') return t('report.exception.risk');
  if (type === 'partialFill') return t('report.exception.partialFill');
  return '-';
};

/**
 * Creates trade exception chips.
 * @param t - Translator.
 * @param item - Trade row.
 * @returns Exception chip view items.
 */
const buildTradeExceptionChips = (t: (key: string) => string, item: Trade): ExceptionChipViewItem[] => {
  const chipTypes = resolveExceptionChipTypes({
    filledRatio: item.filledRatio ?? null,
  });

  return chipTypes.map((type) => ({
    key: type,
    label: getExceptionLabel(t, type),
    tone: getExceptionTone(type),
  }));
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
  const exceptionChips = buildTradeExceptionChips(t, item);
  const tradeTypeLabel = t(`trade.types.${item.type}`);

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
        <span className={`text-sm font-semibold ${getDiffColor(item.profit)}`}>
          {formatSignedNumber(item.profit)}
        </span>
      </div>

      <ExceptionChips chips={exceptionChips} className='mt-2' />
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

  const summaryMetrics: ReportMetricItem[] = [
    {
      key: 'executionMode',
      label: t('trade.executionMode'),
      value: item.executionMode ? t(`trade.executionModes.${item.executionMode}`) : '-',
      tone: 'neutral',
    },
    {
      key: 'filledRatio',
      label: t('trade.filledRatio'),
      value: formatPercent(item.filledRatio, 2),
      tone: 'neutral',
    },
    {
      key: 'orderStatus',
      label: t('trade.orderStatus'),
      value: resolveOrderStatusLabel(t, item.orderStatus),
      tone: 'neutral',
    },
  ];

  const costMetrics: ReportMetricItem[] = [
    {
      key: 'expectedEdgeRate',
      label: t('trade.expectedEdgeRate'),
      value: formatPercent(item.expectedEdgeRate, 2),
      tone: 'neutral',
    },
    {
      key: 'estimatedCostRate',
      label: t('trade.estimatedCostRate'),
      value: formatPercent(item.estimatedCostRate, 2),
      tone: 'neutral',
    },
    {
      key: 'spreadRate',
      label: t('trade.spreadRate'),
      value: formatPercent(item.spreadRate, 2),
      tone: 'neutral',
    },
    {
      key: 'impactRate',
      label: t('trade.impactRate'),
      value: formatPercent(item.impactRate, 2),
      tone: 'neutral',
    },
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

  const exceptionChips = buildTradeExceptionChips(t, item);
  const hasPartialFill = exceptionChips.some((chip) => chip.key === 'partialFill');
  const detailExceptionChips = exceptionChips.filter((chip) => chip.key !== 'partialFill');

  const triggerReason = resolveTriggerReasonLabel(t, item.triggerReason);
  const gateBypassedReason = resolveGateBypassedReasonLabel(t, item.gateBypassedReason);

  return (
    <ReportDetailPane
      title={item.symbol}
      titleAddon={<TradeTypeText type={item.type} label={tradeTypeLabel} />}
      titleSuffix={hasPartialFill ? <StatusPill value={t('report.exception.partialFill')} tone='info' /> : undefined}
      createdAtLabel={t('createdAt')}
      createdAtValue={formatDate(new Date(item.createdAt))}
      headerMetrics={headerMetrics}
      exceptionChips={detailExceptionChips}
    >
      <div className='space-y-5'>
        <TradeDetailSection title={t('report.section.summary')}>
          <DetailMetricGrid items={summaryMetrics} />
        </TradeDetailSection>
        <section className='space-y-4'>
          <div className='space-y-4'>
            <div>
              <p className='mb-1 text-xs font-medium text-gray-500 dark:text-gray-400'>{t('trade.triggerReason')}</p>
              <p className='whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300'>{triggerReason}</p>
            </div>
            <div>
              <p className='mb-1 text-xs font-medium text-gray-500 dark:text-gray-400'>{t('trade.gateBypassedReason')}</p>
              <p className='whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300'>{gateBypassedReason}</p>
            </div>
          </div>
        </section>
        <TradeDetailSection title={t('report.section.cost')}>
          <DetailMetricGrid items={costMetrics} />
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
