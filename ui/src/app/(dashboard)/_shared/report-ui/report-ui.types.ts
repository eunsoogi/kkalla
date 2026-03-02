import type { CSSProperties } from 'react';
import type { ReportTone } from '@/utils/status-tone.types';

export type { ReportTone };

export type CollapsibleStateKey =
  | 'summary'
  | 'validation'
  | 'cost'
  | 'regime'
  | 'reason'
  | 'trigger'
  | 'telemetry';

export interface ReportMetricItem {
  key: string;
  label: string;
  value: string;
  tone?: ReportTone;
  style?: CSSProperties;
}

export interface ReportSectionConfig {
  key: CollapsibleStateKey;
  title: string;
  defaultExpanded?: boolean;
}
