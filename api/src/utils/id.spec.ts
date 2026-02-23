import { generateMonotonicUlid } from './id';

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
});
