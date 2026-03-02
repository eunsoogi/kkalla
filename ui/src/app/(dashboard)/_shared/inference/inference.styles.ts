import type { CSSProperties } from 'react';

import { getNeutralScaleStyle, getReportToneStyle, getValidationTone } from '@/utils/status-tone';

/**
 * Retrieves signed-rate tone color for legacy consumers.
 * @param rate - Signed value.
 * @returns CSS style object.
 */
export const getRateColor = (rate: number): CSSProperties => {
  if (!Number.isFinite(rate)) {
    return getReportToneStyle('neutral');
  }

  if (rate > 0) {
    return getReportToneStyle('positive');
  }

  if (rate < 0) {
    return getReportToneStyle('negative');
  }

  return getReportToneStyle('neutral');
};

/**
 * Retrieves weight color style on neutral scale.
 * @param weight - Weight value (0~1).
 * @returns CSS style object.
 */
export const getWeightColor = (weight: number): CSSProperties => {
  return getNeutralScaleStyle(weight);
};

/**
 * Retrieves confidence color style on neutral scale.
 * @param confidence - Confidence value (0~1).
 * @returns CSS style object.
 */
export const getConfidenceColor = (confidence: number): CSSProperties => {
  return getNeutralScaleStyle(confidence);
};

/**
 * Retrieves validation status color style.
 * @param status - Validation status.
 * @param verdict - Validation verdict.
 * @returns CSS style object.
 */
export const getValidationColor = (status: string, verdict?: string | null): CSSProperties => {
  return getReportToneStyle(getValidationTone(status, verdict));
};
