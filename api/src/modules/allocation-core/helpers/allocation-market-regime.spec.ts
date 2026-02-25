import {
  getMarketRegimeMultiplierAdjustmentByMarketSignals,
  getMarketRegimeMultiplierByFearGreedIndex,
  resolveMarketRegimeMultiplier,
} from './allocation-market-regime';

describe('market-regime utils', () => {
  it('should map fear-greed values to multipliers', () => {
    expect(getMarketRegimeMultiplierByFearGreedIndex(10)).toBe(0.95);
    expect(getMarketRegimeMultiplierByFearGreedIndex(30)).toBe(0.97);
    expect(getMarketRegimeMultiplierByFearGreedIndex(50)).toBe(1);
    expect(getMarketRegimeMultiplierByFearGreedIndex(70)).toBe(0.99);
    expect(getMarketRegimeMultiplierByFearGreedIndex(90)).toBe(0.97);
  });

  it('should fallback to 1 for non-finite values', () => {
    expect(getMarketRegimeMultiplierByFearGreedIndex(Number.NaN)).toBe(1);
  });

  it('should resolve multiplier from reader and fallback on failure', async () => {
    const resolved = await resolveMarketRegimeMultiplier(async () => ({
      feargreed: { index: 80 },
    }));
    expect(resolved).toBe(0.97);

    const fallback = await resolveMarketRegimeMultiplier(async () => {
      throw new Error('failed');
    });
    expect(fallback).toBe(1);
  });

  it('should calculate market signal adjustment in a conservative range', () => {
    expect(getMarketRegimeMultiplierAdjustmentByMarketSignals(60, 20)).toBe(-0.03);
    expect(getMarketRegimeMultiplierAdjustmentByMarketSignals(45, 80)).toBe(0.03);
    expect(getMarketRegimeMultiplierAdjustmentByMarketSignals(52, 55)).toBe(0);
  });

  it('should apply market signal adjustment on top of fear-greed multiplier', async () => {
    const adjusted = await resolveMarketRegimeMultiplier(async () => ({
      feargreed: { index: 50 },
      btcDominance: 60,
      altcoinIndex: 20,
    }));
    expect(adjusted).toBe(0.97);
  });
});
