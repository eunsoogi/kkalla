import type { ReportMetricItem } from './report-ui.types';

export interface DetailMetricGridProps {
  items: ReportMetricItem[];
  className?: string;
  columns?: 2 | 3;
}
