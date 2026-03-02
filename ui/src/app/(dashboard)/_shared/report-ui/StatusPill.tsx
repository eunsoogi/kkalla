'use client';
import React from 'react';

import { getReportToneStyle } from '@/utils/status-tone';
import type { StatusPillProps } from './status-pill.types';

/**
 * Renders a compact status pill.
 * @param params - Input values for the status pill.
 * @returns Rendered React element.
 */
export const StatusPill: React.FC<StatusPillProps> = ({
  label,
  value,
  tone = 'neutral',
  className = '',
  title,
  style,
}) => {
  const resolvedValue = value == null || value.trim().length < 1 ? '-' : value;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium leading-4 ${className}`}
      style={{ ...getReportToneStyle(tone), ...style }}
      title={title}
    >
      {label && <span className='opacity-80'>{label}</span>}
      <span className='tabular-nums'>{resolvedValue}</span>
    </span>
  );
};
