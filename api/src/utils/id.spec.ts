import { isValid } from 'ulid';

import { generateMonotonicUlid, normalizeIdentifierToUlid } from './id';

describe('id utils', () => {
  it('should generate monotonic ULIDs in a single millisecond', () => {
    const now = Date.now();
    const a = generateMonotonicUlid(now);
    const b = generateMonotonicUlid(now);
    const c = generateMonotonicUlid(now);

    expect(a.length).toBe(26);
    expect(b.length).toBe(26);
    expect(c.length).toBe(26);
    expect(a < b).toBe(true);
    expect(b < c).toBe(true);
  });

  it('should normalize UUID into ULID deterministically', () => {
    const uuid = '3f3af1ad-2c1a-4f6c-af4a-4af5a81d53a7';
    const normalizedA = normalizeIdentifierToUlid(uuid);
    const normalizedB = normalizeIdentifierToUlid(uuid);

    expect(normalizedA).toBe(normalizedB);
    expect(normalizedA.length).toBe(26);
    expect(isValid(normalizedA)).toBe(true);
  });

  it('should normalize arbitrary legacy identifiers into ULID deterministically', () => {
    const legacyId = 'unknown';
    const normalizedA = normalizeIdentifierToUlid(legacyId);
    const normalizedB = normalizeIdentifierToUlid(legacyId);

    expect(normalizedA).toBe(normalizedB);
    expect(normalizedA.length).toBe(26);
    expect(isValid(normalizedA)).toBe(true);
  });
});
