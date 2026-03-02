'use client';
import React from 'react';

import { getReportToneStyle } from '@/utils/status-tone';

import type { DetailMetricGridProps } from './detail-metric-grid.types';

/**
 * Renders detail metrics as label-value cards.
 * @param params - Detail metric grid props.
 * @returns Rendered React element.
 */
export const DetailMetricGrid: React.FC<DetailMetricGridProps> = ({ items, className = '', columns = 2 }) => {
  if (!items.length) {
    return null;
  }

  const gridColumnClass = columns === 3 ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2';

  return (
    <dl className={`grid ${gridColumnClass} gap-2 ${className}`}>
      {items.map((item) => {
        const toneStyle = getReportToneStyle(item.tone ?? 'neutral');
        const metricStyle = item.style ?? {};
        const value = item.value?.trim().length ? item.value : '-';

        return (
          <div
            key={item.key}
            className='rounded-lg border px-3 py-2'
            style={{
              borderColor: metricStyle.borderColor ?? toneStyle.borderColor,
              backgroundColor: metricStyle.backgroundColor ?? 'transparent',
            }}
          >
            <dt className='text-xs font-medium text-gray-500 dark:text-gray-400'>{item.label}</dt>
            <dd
              className='mt-1 text-sm font-semibold tabular-nums text-dark dark:text-white'
              style={{ color: metricStyle.color ?? toneStyle.color }}
            >
              {value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
};
