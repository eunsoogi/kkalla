'use client';
import React from 'react';

import { StatusPill } from './StatusPill';
import type { MetricRowProps } from './metric-row.types';

/**
 * Renders a responsive row of compact metric pills.
 * @param params - Input values for the metric row.
 * @returns Rendered React element.
 */
export const MetricRow: React.FC<MetricRowProps> = ({ items, className = '' }) => {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {items.map((item) => (
        <StatusPill key={item.key} label={item.label} value={item.value} tone={item.tone} style={item.style} />
      ))}
    </div>
  );
};
