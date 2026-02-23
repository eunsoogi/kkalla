import { monotonicFactory } from 'ulid';

export const ULID_LENGTH = 26;

export const ULID_COLUMN_OPTIONS = {
  type: 'char' as const,
  length: ULID_LENGTH,
  charset: 'ascii',
  collation: 'ascii_bin',
};

const monotonicUlidFactory = monotonicFactory();

export function generateMonotonicUlid(timeMs?: number): string {
  return monotonicUlidFactory(timeMs);
}

export function assignUlidIfMissing(target: { id?: string }): void {
  if (!target.id) {
    target.id = generateMonotonicUlid();
  }
}
