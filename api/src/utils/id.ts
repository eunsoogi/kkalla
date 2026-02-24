import { createHash } from 'crypto';
import { isValid, monotonicFactory, uuidToULID } from 'ulid';

export const ULID_LENGTH = 26;

export const ULID_COLUMN_OPTIONS = {
  type: 'char' as const,
  length: ULID_LENGTH,
  charset: 'ascii',
  collation: 'ascii_bin',
};

const monotonicUlidFactory = monotonicFactory();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function generateMonotonicUlid(timeMs?: number): string {
  return monotonicUlidFactory(timeMs);
}

export function assignUlidIfMissing(target: { id?: string }): void {
  if (!target.id) {
    target.id = generateMonotonicUlid();
  }
}

export function normalizeIdentifierToUlid(value: string): string {
  if (isValid(value)) {
    return value.toUpperCase();
  }

  if (UUID_PATTERN.test(value)) {
    return uuidToULID(value);
  }

  return uuidToULID(hashToUuid(value));
}

function hashToUuid(value: string): string {
  const hash = createHash('sha256').update(value).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
