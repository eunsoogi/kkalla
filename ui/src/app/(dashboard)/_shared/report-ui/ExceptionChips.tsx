'use client';
import React from 'react';

import { StatusPill } from './StatusPill';
import type { ExceptionChipsProps } from './report-master-detail.types';

/**
 * Renders exception chips.
 * @param params - Exception chip props.
 * @returns Rendered React element.
 */
export const ExceptionChips: React.FC<ExceptionChipsProps> = ({ chips, className = '' }) => {
  if (!chips.length) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {chips.map((chip) => (
        <StatusPill key={chip.key} value={chip.label} tone={chip.tone} />
      ))}
    </div>
  );
};
