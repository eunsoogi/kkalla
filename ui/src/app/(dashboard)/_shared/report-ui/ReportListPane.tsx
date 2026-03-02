'use client';
import React from 'react';

import type { ReportListPaneProps } from './report-master-detail.types';

/**
 * Renders list container for master-detail reports.
 * @param params - List pane props.
 * @returns Rendered React element.
 */
export const ReportListPane: React.FC<ReportListPaneProps> = ({ title, children, className = '' }) => {
  return (
    <section className={`w-full min-w-0 ${className}`}>
      {title ? <h3 className='mb-3 text-sm font-semibold text-dark dark:text-white'>{title}</h3> : null}
      {children}
    </section>
  );
};
