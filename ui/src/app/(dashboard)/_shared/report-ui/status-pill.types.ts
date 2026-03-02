import type { CSSProperties } from 'react';

import type { ReportTone } from '@/utils/status-tone.types';

export interface StatusPillProps {
  label?: string;
  value?: string | null;
  tone?: ReportTone;
  className?: string;
  title?: string;
  style?: CSSProperties;
}
