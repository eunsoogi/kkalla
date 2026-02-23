export type JsonRecord = Record<string, unknown>;

/**
 * Handles try parse json record in the trade execution ledger workflow.
 * @param value - Input value for value.
 * @returns Result produced by the trade execution ledger flow.
 */
export function tryParseJsonRecord(value: string | undefined): JsonRecord | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as JsonRecord) : null;
  } catch {
    return null;
  }
}

/**
 * Retrieves string value for the trade execution ledger flow.
 * @param payload - Input value for payload.
 * @param key - Input value for key.
 * @returns Formatted string output for the operation.
 */
export function readStringValue(payload: JsonRecord | null | undefined, key: string): string | null {
  const value = payload?.[key];
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Handles stringify unknown error in the trade execution ledger workflow.
 * @param error - Error captured from a failed operation.
 * @returns Formatted string output for the operation.
 */
export function stringifyUnknownError(error: unknown): string {
  // Persist a diagnostic string regardless of error shape for ledger audit trails.
  if (error instanceof Error) {
    return error.stack || error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Checks non empty string in the trade execution ledger context.
 * @param value - Input value for value.
 * @returns Formatted string output for the operation.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Checks valid date string in the trade execution ledger context.
 * @param value - Input value for value.
 * @returns Formatted string output for the operation.
 */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  return Number.isFinite(new Date(value).getTime());
}

/**
 * Checks positive attempt count in the trade execution ledger context.
 * @param context - Execution context for the trade execution ledger flow.
 * @returns Computed numeric value for the operation.
 */
export function hasPositiveAttemptCount(context: { attemptCount?: number }): context is { attemptCount: number } {
  return typeof context.attemptCount === 'number' && Number.isFinite(context.attemptCount) && context.attemptCount > 0;
}
