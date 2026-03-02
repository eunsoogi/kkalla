'use client';
import React from 'react';

import type { ReportTone } from '@/utils/status-tone.types';
import { DetailMetricGrid } from './DetailMetricGrid';
import type { ReportDetailPaneProps } from './report-master-detail.types';

const EXCEPTION_TONE_CLASS: Record<ReportTone, string> = {
  neutral: 'text-gray-600 dark:text-gray-300',
  positive: 'text-emerald-600 dark:text-emerald-300',
  negative: 'text-rose-600 dark:text-rose-300',
  warning: 'text-amber-600 dark:text-amber-300',
  info: 'text-sky-600 dark:text-sky-300',
};

/**
 * Renders detail panel for master-detail reports.
 * @param params - Detail pane props.
 * @returns Rendered React element.
 */
export const ReportDetailPane: React.FC<ReportDetailPaneProps> = ({
  title,
  titleAddon,
  titleSuffix,
  createdAtLabel,
  createdAtValue,
  headerMetrics = [],
  exceptionChips = [],
  children,
  className = '',
}) => {
  return (
    <section className={`flex min-h-[420px] w-full min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:min-h-0 md:max-h-[calc(100dvh-112px)] dark:border-gray-700 dark:bg-dark ${className}`}>
      <header className='space-y-3 rounded-t-xl border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-dark'>
        <div className='flex min-w-0 items-start justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-2'>
            {titleAddon}
            <h3 className='min-w-0 truncate text-base font-semibold text-dark dark:text-white'>{title}</h3>
            {titleSuffix}
          </div>
          <span className='shrink-0 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400'>
            {createdAtLabel}: {createdAtValue}
          </span>
        </div>
        {headerMetrics.length > 0 ? <DetailMetricGrid items={headerMetrics} columns={3} /> : null}
        {exceptionChips.length > 0 ? (
          <ul className='flex flex-wrap items-center gap-x-4 gap-y-1 text-sm'>
            {exceptionChips.map((chip) => (
              <li key={chip.key} className={`inline-flex items-center gap-1 ${EXCEPTION_TONE_CLASS[chip.tone ?? 'neutral']}`}>
                <span className='h-1.5 w-1.5 rounded-full bg-current' aria-hidden='true' />
                <span>{chip.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </header>
      <div className='min-h-0 flex-1 overflow-y-auto p-4'>{children}</div>
    </section>
  );
};
