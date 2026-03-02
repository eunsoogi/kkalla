import type { ExceptionChipType, ExceptionRuleInput } from '@/utils/report-priority.types';

const VALIDATION_RUNNING_STATUSES = new Set(['pending', 'running']);

/**
 * Returns a concise first-line summary for long reason text.
 * @param reason - Full reason text.
 * @param maxLength - Max text length.
 * @returns Summarized reason text.
 */
export const getReasonSummary = (reason?: string | null, maxLength = 110): string => {
  const normalized = reason?.trim();
  if (!normalized) {
    return '-';
  }

  const firstLine = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return '-';
  }

  if (firstLine.length <= maxLength) {
    return firstLine;
  }

  return `${firstLine.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

/**
 * Summarizes risk flags into a compact display string.
 * @param riskFlags - Risk flag array.
 * @param visibleCount - Number of visible flags.
 * @returns Summary string.
 */
export const getRiskFlagSummary = (riskFlags?: string[] | null, visibleCount = 2): string => {
  if (!Array.isArray(riskFlags) || riskFlags.length === 0) {
    return '-';
  }

  if (riskFlags.length <= visibleCount) {
    return riskFlags.join(', ');
  }

  const visible = riskFlags.slice(0, visibleCount).join(', ');
  return `${visible} +${riskFlags.length - visibleCount}`;
};

/**
 * Resolves exception chip types for list-level anomaly signaling.
 * @param input - Input status snapshot.
 * @returns Ordered chip types.
 */
export const resolveExceptionChipTypes = (input: ExceptionRuleInput): ExceptionChipType[] => {
  const chipTypes = new Set<ExceptionChipType>();

  const statuses = [input.validation24h?.status, input.validation72h?.status].filter(
    (status): status is string => typeof status === 'string',
  );

  if (statuses.some((status) => status === 'failed')) {
    chipTypes.add('validationFailed');
  } else if (statuses.some((status) => VALIDATION_RUNNING_STATUSES.has(status))) {
    chipTypes.add('validationRunning');
  }

  if (input.regimeStale === true) {
    chipTypes.add('regimeStale');
  }

  if (Array.isArray(input.riskFlags) && input.riskFlags.length > 0) {
    chipTypes.add('risk');
  }

  if (typeof input.filledRatio === 'number' && Number.isFinite(input.filledRatio)) {
    if (input.filledRatio > 0 && input.filledRatio < 1) {
      chipTypes.add('partialFill');
    }
  }

  return Array.from(chipTypes);
};
