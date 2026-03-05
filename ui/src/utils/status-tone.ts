import type { CSSProperties } from 'react';

import type { ExceptionChipType } from '@/utils/report-priority.types';
import type { ReportTone } from '@/utils/status-tone.types';

interface ToneVarSet {
  bg: string;
  fg: string;
  border: string;
}

const REPORT_TONE_VARS: Record<ReportTone, ToneVarSet> = {
  neutral: {
    bg: 'var(--color-report-neutral-bg)',
    fg: 'var(--color-report-neutral-fg)',
    border: 'var(--color-report-neutral-border)',
  },
  positive: {
    bg: 'var(--color-report-positive-bg)',
    fg: 'var(--color-report-positive-fg)',
    border: 'var(--color-report-positive-border)',
  },
  negative: {
    bg: 'var(--color-report-negative-bg)',
    fg: 'var(--color-report-negative-fg)',
    border: 'var(--color-report-negative-border)',
  },
  warning: {
    bg: 'var(--color-report-warning-bg)',
    fg: 'var(--color-report-warning-fg)',
    border: 'var(--color-report-warning-border)',
  },
  info: {
    bg: 'var(--color-report-info-bg)',
    fg: 'var(--color-report-info-fg)',
    border: 'var(--color-report-info-border)',
  },
};

const REPORT_NEUTRAL_SCALE = [
  {
    bg: 'var(--color-report-neutral-scale-low-bg)',
    fg: 'var(--color-report-neutral-scale-low-fg)',
    border: 'var(--color-report-neutral-scale-low-border)',
  },
  {
    bg: 'var(--color-report-neutral-scale-mid-bg)',
    fg: 'var(--color-report-neutral-scale-mid-fg)',
    border: 'var(--color-report-neutral-scale-mid-border)',
  },
  {
    bg: 'var(--color-report-neutral-scale-high-bg)',
    fg: 'var(--color-report-neutral-scale-high-fg)',
    border: 'var(--color-report-neutral-scale-high-border)',
  },
] as const;

/**
 * Retrieves inline style for a report tone pill.
 * @param tone - Target report tone.
 * @returns CSS style object.
 */
export const getReportToneStyle = (tone: ReportTone = 'neutral'): CSSProperties => {
  const vars = REPORT_TONE_VARS[tone];

  return {
    backgroundColor: vars.bg,
    color: vars.fg,
    borderColor: vars.border,
  };
};

/**
 * Retrieves neutral scale style for score-like metrics.
 * @param score - 0~1 ratio value.
 * @returns CSS style object.
 */
export const getNeutralScaleStyle = (score?: number | null): CSSProperties => {
  const value = Number.isFinite(score) ? Math.max(0, Math.min(1, score as number)) : 0;

  if (value >= 0.67) {
    const high = REPORT_NEUTRAL_SCALE[2];
    return {
      backgroundColor: high.bg,
      color: high.fg,
      borderColor: high.border,
    };
  }

  if (value >= 0.34) {
    const mid = REPORT_NEUTRAL_SCALE[1];
    return {
      backgroundColor: mid.bg,
      color: mid.fg,
      borderColor: mid.border,
    };
  }

  const low = REPORT_NEUTRAL_SCALE[0];
  return {
    backgroundColor: low.bg,
    color: low.fg,
    borderColor: low.border,
  };
};

/**
 * Resolves report tone for validation status.
 * @param status - Validation status.
 * @param verdict - Validation verdict.
 * @returns Report tone.
 */
export const getValidationTone = (status?: string | null, verdict?: string | null): ReportTone => {
  if (status === 'pending') return 'neutral';
  if (status === 'running') return 'info';
  if (status === 'failed') return 'negative';

  if (verdict === 'good') return 'positive';
  if (verdict === 'mixed') return 'warning';
  if (verdict === 'bad') return 'negative';
  if (verdict === 'invalid') return 'neutral';

  return 'neutral';
};

/**
 * Resolves report tone for signed numeric value.
 * @param value - Signed number.
 * @returns Report tone.
 */
export const getSignedValueTone = (value?: number | null): ReportTone => {
  if (value == null || !Number.isFinite(value)) {
    return 'neutral';
  }

  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
};

/**
 * Resolves exception chip tone.
 * @param type - Exception type.
 * @returns Report tone.
 */
export const getExceptionTone = (type: ExceptionChipType): ReportTone => {
  if (type === 'validationFailed') return 'negative';
  if (type === 'validationRunning') return 'info';
  if (type === 'regimeStale') return 'warning';
  if (type === 'risk') return 'warning';
  return 'neutral';
};
