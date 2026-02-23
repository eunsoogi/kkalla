import { Category } from '@/modules/category/category.enum';

import { parseQueuedInference } from './trade-execution-message';

describe('trade-execution-message utils', () => {
  it('should parse valid queued inference', () => {
    const parsed = parseQueuedInference({
      id: 'id-1',
      batchId: 'batch-1',
      symbol: 'BTC/KRW',
      category: Category.COIN_MAJOR,
      intensity: 0.45,
      action: 'buy',
      riskFlags: ['volatility', 1, null],
    });

    expect(parsed.id).toBe('id-1');
    expect(parsed.batchId).toBe('batch-1');
    expect(parsed.symbol).toBe('BTC/KRW');
    expect(parsed.category).toBe(Category.COIN_MAJOR);
    expect(parsed.intensity).toBe(0.45);
    expect(parsed.action).toBe('buy');
    expect(parsed.riskFlags).toEqual(['volatility']);
  });

  it('should throw on invalid category, identity, or symbol', () => {
    expect(() =>
      parseQueuedInference({
        id: 'id-1',
        batchId: 'batch-1',
        symbol: 'BTC/KRW',
        category: 'unknown',
      }),
    ).toThrow('Invalid inference category');

    expect(() =>
      parseQueuedInference({
        id: 'id-1',
        batchId: 'batch-1',
        symbol: '',
        category: Category.COIN_MAJOR,
      }),
    ).toThrow('Invalid inference symbol');

    expect(() =>
      parseQueuedInference({
        id: '',
        batchId: 'batch-1',
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
      }),
    ).toThrow('Invalid inference identity');
  });
});
