'use client';
import React from 'react';

import { useTranslations } from 'next-intl';

import { MarketRegimeFeargreed } from '@/app/(dashboard)/_components/home/_types/market-regime.types';
import {
  getAltcoinSeasonGaugeSegments,
  getBtcDominanceGaugeSegments,
  GaugeSegment,
  getDiffColor,
  getDiffPrefix,
  getFeargreedGaugeSegments,
} from '@/utils/color';
import { formatDate } from '@/utils/date';

/**
 * Formats asOf date for dashboard widget.
 * @param value - Input value for asOf.
 * @returns Formatted string output for the operation.
 */
const formatAsOf = (value?: string | Date | null): string => {
  if (!value) {
    return '-';
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return formatDate(parsed);
};

type MarketRegimeGaugeType = 'btcDominance' | 'altcoinSeasonIndex';

const VISIBLE_ARC_DASH = 180;

const clampGaugeValue = (value: number | null | undefined): number => {
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
};

const ArcGauge = ({
  gaugeId,
  value,
  segments,
  center,
}: {
  gaugeId: string;
  value: number | null | undefined;
  segments: GaugeSegment[];
  center: React.ReactNode;
}) => {
  const safeValue = clampGaugeValue(value);

  return (
    <div className='flex flex-col items-center'>
      <div className='relative w-64 h-64'>
        <svg viewBox='0 0 100 100' className='absolute left-0 top-0 h-full w-full'>
          <defs>
            {segments.map((segment, index) => (
              <linearGradient key={`${gaugeId}-bg-gradient-${index}`} id={`regimeGaugeGradient-${gaugeId}-${index}`} gradientTransform='rotate(90)'>
                <stop offset='0%' stopColor={segment.startColor} />
                <stop offset='100%' stopColor={segment.endColor} />
              </linearGradient>
            ))}
          </defs>
          {segments.map((segment, index) => {
            const segmentLength = ((segment.end - segment.start) * VISIBLE_ARC_DASH) / 100;
            const segmentOffset = (segment.start * VISIBLE_ARC_DASH) / 100;

            return (
              <circle
                key={`${gaugeId}-bg-segment-${index}`}
                cx={50}
                cy={50}
                r={45}
                strokeWidth={10}
                stroke={`url(#regimeGaugeGradient-${gaugeId}-${index})`}
                fill='none'
                opacity={0.25}
                strokeDasharray={`${segmentLength} 360`}
                strokeDashoffset={`-${segmentOffset}`}
                transform='rotate(155 50 50)'
              />
            );
          })}
          {segments.map((segment, index) => {
            const activeEnd = Math.min(safeValue, segment.end);
            if (activeEnd <= segment.start) {
              return null;
            }

            const activeLength = ((activeEnd - segment.start) * VISIBLE_ARC_DASH) / 100;
            const activeOffset = (segment.start * VISIBLE_ARC_DASH) / 100;

            return (
              <circle
                key={`${gaugeId}-active-segment-${index}`}
                cx={50}
                cy={50}
                r={45}
                strokeWidth={10}
                stroke={`url(#regimeGaugeGradient-${gaugeId}-${index})`}
                fill='none'
                strokeDasharray={`${activeLength} 360`}
                strokeDashoffset={`-${activeOffset}`}
                transform='rotate(155 50 50)'
              />
            );
          })}
        </svg>
        <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center'>{center}</div>
      </div>
    </div>
  );
};

/**
 * Renders a radial gauge for market regime values.
 * @param params - Input values for gauge render.
 * @returns Rendered React element for this view.
 */
const MarketRegimeGauge = ({
  stateLabel,
  value,
  gaugeId,
  type,
  pointUnitLabel,
}: {
  stateLabel: string;
  value: number | null | undefined;
  gaugeId: string;
  type: MarketRegimeGaugeType;
  pointUnitLabel: string;
}) => {
  const safeValue = clampGaugeValue(value);
  const displayValue =
    value != null && Number.isFinite(value)
      ? type === 'btcDominance'
        ? value.toFixed(2)
        : Number(value.toFixed(2)).toString()
      : '-';
  const unitLabel = type === 'btcDominance' ? '%' : pointUnitLabel;
  const gaugeBackgroundSegments = type === 'btcDominance' ? getBtcDominanceGaugeSegments() : getAltcoinSeasonGaugeSegments();

  return (
    <ArcGauge
      gaugeId={gaugeId}
      value={safeValue}
      segments={gaugeBackgroundSegments}
      center={
        <>
          <div className='text-3xl font-bold text-gray-900 dark:text-white'>{displayValue}</div>
          <div className='text-lg text-gray-500 dark:text-gray-400'>{unitLabel}</div>
          <div className='text-sm mt-1 text-gray-700 dark:text-gray-200'>{stateLabel}</div>
        </>
      }
    />
  );
};

interface FeargreedGaugeProps {
  item?: MarketRegimeFeargreed | null;
  gaugeId?: string;
  pointUnitLabel: string;
}

/**
 * Renders the Feargreed gauge body for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
const FeargreedGauge = ({ item = null, gaugeId = 'feargreed', pointUnitLabel }: FeargreedGaugeProps) => {
  const hasScore = Number.isFinite(item?.index);
  const score = hasScore ? Number(item?.index) : 0;
  const displayScore = hasScore ? score.toLocaleString() : '-';
  const diff = hasScore && Number.isFinite(item?.diff) ? Number(item?.diff) : null;
  const stage = item?.classification ?? '-';

  return (
    <ArcGauge
      gaugeId={gaugeId}
      value={score}
      segments={getFeargreedGaugeSegments()}
      center={
        <>
          <div className='flex items-start justify-center gap-1'>
            <div className='text-3xl font-bold leading-none text-gray-900 dark:text-white'>{displayScore}</div>
            {diff != null && (
              <div className={`mt-0.5 text-xs font-medium ${getDiffColor(diff)}`}>
                {getDiffPrefix(diff)}
                {diff.toLocaleString()}
              </div>
            )}
          </div>
          <div className='text-lg text-gray-500 dark:text-gray-400'>{pointUnitLabel}</div>
          <div className='text-sm mt-1 text-gray-700 dark:text-gray-200'>{stage}</div>
        </>
      }
    />
  );
};

interface FeargreedWidgetProps {
  title: string;
  item?: MarketRegimeFeargreed | null;
  asOf?: string | Date | null;
  isLoading?: boolean;
  gaugeId?: string;
}

/**
 * Renders the Feargreed Widget UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
export const FeargreedWidget = ({
  title,
  item = null,
  asOf,
  isLoading = false,
  gaugeId = 'feargreed',
}: FeargreedWidgetProps) => {
  const t = useTranslations();

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0 overflow-hidden'>
      <div className='px-4 sm:px-6 mb-4'>
        <h5 className='card-title text-dark dark:text-white'>{title}</h5>
      </div>
      {isLoading ? (
        <MarketRegimeWidgetSkeleton />
      ) : (
        <div className='px-4 sm:px-6 pb-6'>
          <FeargreedGauge item={item} gaugeId={gaugeId} pointUnitLabel={t('unitPoint')} />
          <div className='mt-3 w-full'>
            <span className='text-xs text-gray-600 dark:text-gray-300'>
              {`${t('dashboard.marketRegimeAsOf')}: ${formatAsOf(asOf ?? item?.date)}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Renders the Market Regime Widget skeleton UI for the dashboard UI.
 * @returns Rendered React element for this view.
 */
export const MarketRegimeWidgetSkeleton = () => (
  <div className='animate-pulse px-4 py-6 space-y-3'>
    <div className='h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3' />
    <div className='h-64 bg-gray-200 dark:bg-gray-700 rounded w-full' />
    <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6' />
  </div>
);

interface MarketRegimeWidgetProps {
  title: string;
  stateLabel: string;
  gaugeId: string;
  type: MarketRegimeGaugeType;
  value?: number | null;
  asOf?: string | Date | null;
  isLoading?: boolean;
}

/**
 * Renders the Market Regime Widget UI for the dashboard UI.
 * @param params - Input values for the dashboard UI operation.
 * @returns Rendered React element for this view.
 */
export const MarketRegimeWidget = ({
  title,
  stateLabel,
  gaugeId,
  type,
  value,
  asOf,
  isLoading = false,
}: MarketRegimeWidgetProps) => {
  const t = useTranslations();

  return (
    <div className='rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-dark pt-6 px-0 relative w-full min-h-0 overflow-hidden'>
      <div className='px-4 sm:px-6 mb-4'>
        <h5 className='card-title text-dark dark:text-white'>{title}</h5>
      </div>
      {isLoading ? (
        <MarketRegimeWidgetSkeleton />
      ) : (
        <div className='px-4 sm:px-6 pb-6'>
          <MarketRegimeGauge
            stateLabel={stateLabel}
            value={value}
            gaugeId={gaugeId}
            type={type}
            pointUnitLabel={t('unitPoint')}
          />
          <div className='mt-3 w-full'>
            <span className='text-xs text-gray-600 dark:text-gray-300'>
              {`${t('dashboard.marketRegimeAsOf')}: ${formatAsOf(asOf)}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
