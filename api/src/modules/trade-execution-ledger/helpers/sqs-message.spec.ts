import {
  hasPositiveAttemptCount,
  isNonEmptyString,
  isValidDateString,
  readStringValue,
  stringifyUnknownError,
  tryParseJsonRecord,
} from './sqs-message';

describe('sqs-message utils', () => {
  describe('tryParseJsonRecord', () => {
    it('should parse valid object JSON', () => {
      expect(tryParseJsonRecord('{"a":"b"}')).toEqual({ a: 'b' });
    });

    it('should return parsed object-like JSON and null for invalid JSON', () => {
      expect(tryParseJsonRecord('[]')).toEqual([]);
      expect(tryParseJsonRecord('{')).toBeNull();
      expect(tryParseJsonRecord(undefined)).toBeNull();
    });
  });

  describe('readStringValue', () => {
    it('should return trimmed string value', () => {
      expect(readStringValue({ key: '  value  ' }, 'key')).toBe('value');
    });

    it('should return null for non-string or empty string', () => {
      expect(readStringValue({ key: 1 }, 'key')).toBeNull();
      expect(readStringValue({ key: '   ' }, 'key')).toBeNull();
      expect(readStringValue(null, 'key')).toBeNull();
    });
  });

  describe('stringifyUnknownError', () => {
    it('should stringify Error and primitive values', () => {
      const error = new Error('boom');
      expect(stringifyUnknownError(error)).toContain('boom');
      expect(stringifyUnknownError('x')).toBe('x');
      expect(stringifyUnknownError({ a: 1 })).toBe('{"a":1}');
    });
  });

  it('should validate non-empty string and date strings', () => {
    expect(isNonEmptyString('x')).toBe(true);
    expect(isNonEmptyString('   ')).toBe(false);
    expect(isValidDateString('2026-02-23T00:00:00.000Z')).toBe(true);
    expect(isValidDateString('not-a-date')).toBe(false);
  });

  it('should check positive attempt count', () => {
    expect(hasPositiveAttemptCount({ attemptCount: 1 })).toBe(true);
    expect(hasPositiveAttemptCount({ attemptCount: 0 })).toBe(false);
    expect(hasPositiveAttemptCount({})).toBe(false);
  });
});
