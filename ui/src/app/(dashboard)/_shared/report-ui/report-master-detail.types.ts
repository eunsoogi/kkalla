import type { ReactNode } from 'react';

import type { ReportTone } from '@/utils/status-tone.types';

import type { ReportMetricItem } from './report-ui.types';

export interface ExceptionChipViewItem {
  key: string;
  label: string;
  tone?: ReportTone;
}

export interface ReportMasterDetailLayoutProps {
  listPane: ReactNode;
  detailPane: ReactNode;
  mobileDetailOpen: boolean;
  mobileDetailTitle: ReactNode;
  mobileDetailAriaLabel?: string;
  onMobileDetailClose: () => void;
}

export interface ReportListPaneProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export interface ExceptionChipsProps {
  chips: ExceptionChipViewItem[];
  className?: string;
}

export interface ReportDetailPaneProps {
  title: string;
  titleAddon?: ReactNode;
  titleSuffix?: ReactNode;
  createdAtLabel: string;
  createdAtValue: string;
  headerMetrics?: ReportMetricItem[];
  exceptionChips?: ExceptionChipViewItem[];
  children: ReactNode;
  className?: string;
}
