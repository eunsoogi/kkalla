import { getMarketRegimeMultiplierByFearGreedValue, resolveMarketRegimeMultiplier } from './allocation-market-regime';

describe('market-regime utils', () => {
  it('should map fear-greed values to multipliers', () => {
    expect(getMarketRegimeMultiplierByFearGreedValue(10)).toBe(0.95);
    expect(getMarketRegimeMultiplierByFearGreedValue(30)).toBe(0.97);
    expect(getMarketRegimeMultiplierByFearGreedValue(50)).toBe(1);
    expect(getMarketRegimeMultiplierByFearGreedValue(70)).toBe(0.99);
    expect(getMarketRegimeMultiplierByFearGreedValue(90)).toBe(0.97);
  });

  it('should fallback to 1 for non-finite values', () => {
    expect(getMarketRegimeMultiplierByFearGreedValue(Number.NaN)).toBe(1);
  });

  it('should resolve multiplier from reader and fallback on failure', async () => {
    const resolved = await resolveMarketRegimeMultiplier(async () => ({ value: 80 }));
    expect(resolved).toBe(0.97);

    const fallback = await resolveMarketRegimeMultiplier(async () => {
      throw new Error('failed');
    });
    expect(fallback).toBe(1);
  });
});
