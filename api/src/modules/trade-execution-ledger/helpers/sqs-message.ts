export type JsonRecord = Record<string, unknown>;

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

export function readStringValue(payload: JsonRecord | null | undefined, key: string): string | null {
  const value = payload?.[key];
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function stringifyUnknownError(error: unknown): string {
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

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  return Number.isFinite(new Date(value).getTime());
}

export function hasPositiveAttemptCount(context: { attemptCount?: number }): context is { attemptCount: number } {
  return typeof context.attemptCount === 'number' && Number.isFinite(context.attemptCount) && context.attemptCount > 0;
}
