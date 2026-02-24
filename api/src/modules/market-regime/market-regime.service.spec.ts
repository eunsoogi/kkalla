import { of } from 'rxjs';

import { MarketRegimeService } from './market-regime.service';

describe('MarketRegimeService', () => {
  const FIXED_NOW = new Date('2026-02-24T12:00:00.000Z').getTime();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const buildService = () => {
    const i18n = {
      t: jest.fn((key: string, options?: { args?: Record<string, unknown> }) => {
        const args = options?.args ?? {};
        return `${key} ${JSON.stringify(args)}`;
      }),
    };
    const errorService = {
      retry: jest.fn(async (operation: () => Promise<unknown>) => operation()),
      getErrorMessage: jest.fn((error: unknown) => String(error)),
    };
    const httpService = {
      get: jest.fn(),
    };
    const cacheService = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const service = new MarketRegimeService(i18n as any, errorService as any, httpService as any, cacheService as any);

    return {
      service,
      i18n,
      errorService,
      httpService,
      cacheService,
    };
  };

  const createFeargreedApiResponse = (latestValue: string, previousValue: string) =>
    of({
      data: {
        name: 'Fear and Greed Index',
        data: [
          {
            value: latestValue,
            value_classification: 'Neutral',
            timestamp: '1708776000',
            time_until_update: '3600',
          },
          {
            value: previousValue,
            value_classification: 'Neutral',
            timestamp: '1708689600',
            time_until_update: '0',
          },
        ],
        metadata: {
          error: null,
        },
      },
    });

  const createCmcOverviewResponse = (
    btcDominance: number,
    altcoinIndex: number,
    timestamp = '2026-02-24T12:00:00.000Z',
  ) =>
    of({
      data: {
        status: {
          timestamp,
          error_code: '0',
          error_message: 'SUCCESS',
        },
        data: {
          marketDominance: {
            btcPercentage: btcDominance,
          },
          altcoinIndex: {
            index: altcoinIndex,
          },
        },
      },
    });

  it('should return live snapshot and persist last success cache', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    const { service, httpService, cacheService } = buildService();

    cacheService.get.mockResolvedValue(null);
    httpService.get.mockImplementation((url: string) => {
      if (url.includes('global-metrics/crypto/overview/detail')) {
        return createCmcOverviewResponse(54.32, 60, '2026-02-24T12:00:00.000Z');
      }

      if (url.includes('alternative.me/fng')) {
        return createFeargreedApiResponse('52', '49');
      }

      throw new Error(`unexpected url: ${url}`);
    });

    const snapshot = await service.getSnapshot();

    expect(snapshot.source).toBe('live');
    expect(snapshot.btcDominance).toBe(54.32);
    expect(snapshot.btcDominanceClassification).toBe('transition');
    expect(snapshot.altcoinIndex).toBe(60);
    expect(snapshot.altcoinIndexClassification).toBe('neutral');
    expect(snapshot.feargreed).toEqual(
      expect.objectContaining({
        index: 52,
        classification: 'Neutral',
        timestamp: 1708776000,
      }),
    );
    expect(snapshot.isStale).toBe(false);
    expect(cacheService.set).toHaveBeenCalledWith(
      'market-regime:last-success:v1',
      expect.objectContaining({
        btcDominance: 54.32,
        altcoinIndex: 60,
        feargreed: expect.objectContaining({
          index: 52,
          classification: 'Neutral',
          timestamp: 1708776000,
        }),
      }),
      60 * 60 * 24 * 7,
    );
  });

  it('should fallback to cached snapshot when CMC fetch fails and cache is older than recent window', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    const { service, httpService, cacheService } = buildService();

    const cachedSnapshot = {
      btcDominance: 57.21,
      altcoinIndex: 33.4,
      asOf: new Date(FIXED_NOW - 70 * 60 * 1000).toISOString(),
    };

    cacheService.get.mockImplementation(async (key: string) => {
      if (key === 'market-regime:last-success:v1') {
        return cachedSnapshot;
      }
      return null;
    });

    httpService.get.mockImplementation((url: string) => {
      if (url.includes('global-metrics/crypto/overview/detail')) {
        throw new Error('cmc failed');
      }
      if (url.includes('alternative.me/fng')) {
        return createFeargreedApiResponse('52', '49');
      }
      throw new Error(`unexpected url: ${url}`);
    });

    const snapshot = await service.getSnapshot();

    expect(snapshot.source).toBe('cache_fallback');
    expect(snapshot.isStale).toBe(true);
    expect(snapshot.staleAgeMinutes).toBe(70);
    expect(snapshot.btcDominance).toBe(57.21);
    expect(snapshot.btcDominanceClassification).toBe('transition');
    expect(snapshot.altcoinIndex).toBe(33.4);
    expect(snapshot.altcoinIndexClassification).toBe('neutral');
  });

  it('should reuse cached snapshot within one hour and keep stale false', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    const { service, httpService, cacheService } = buildService();

    cacheService.get.mockImplementation(async (key: string) => {
      if (key === 'market-regime:last-success:v1') {
        return {
          btcDominance: 58,
          altcoinIndex: 25,
          asOf: new Date(FIXED_NOW - 40 * 60 * 1000).toISOString(),
        };
      }
      return null;
    });

    httpService.get.mockImplementation((url: string) => {
      if (url.includes('global-metrics/crypto/overview/detail')) {
        throw new Error('cmc failed');
      }
      if (url.includes('alternative.me/fng')) {
        return createFeargreedApiResponse('52', '49');
      }
      throw new Error(`unexpected url: ${url}`);
    });

    const snapshot = await service.getSnapshot();

    expect(snapshot.source).toBe('live');
    expect(snapshot.isStale).toBe(false);
    expect(snapshot.staleAgeMinutes).toBe(40);
    expect(snapshot.btcDominanceClassification).toBe('transition');
    expect(snapshot.altcoinIndexClassification).toBe('bitcoin_season');
    expect(httpService.get).not.toHaveBeenCalled();
  });

  it('should throw when CMC fails and no cached snapshot exists', async () => {
    const { service, httpService, cacheService } = buildService();

    cacheService.get.mockResolvedValue(null);
    httpService.get.mockImplementation((url: string) => {
      if (url.includes('global-metrics/crypto/overview/detail')) {
        throw new Error('cmc failed');
      }
      if (url.includes('alternative.me/fng')) {
        throw new Error('feargreed failed');
      }
      throw new Error(`unexpected url: ${url}`);
    });

    await expect(service.getSnapshot()).rejects.toThrow('no cached fallback');
  });

  it('should dedupe in-flight snapshot requests', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    const { service, errorService, httpService, cacheService } = buildService();

    cacheService.get.mockResolvedValue(null);
    httpService.get.mockImplementation((url: string) => {
      if (url.includes('global-metrics/crypto/overview/detail')) {
        return createCmcOverviewResponse(54, 60, '2026-02-24T12:00:00.000Z');
      }
      if (url.includes('alternative.me/fng')) {
        return createFeargreedApiResponse('52', '49');
      }
      throw new Error(`unexpected url: ${url}`);
    });
    errorService.retry.mockImplementation(async (operation: () => Promise<unknown>) => operation());

    const [first, second] = await Promise.all([service.getSnapshot(), service.getSnapshot()]);

    expect(first.btcDominance).toBe(54);
    expect(second.btcDominance).toBe(54);
    expect(httpService.get).toHaveBeenCalledTimes(2);
    expect(errorService.retry).toHaveBeenCalledTimes(2);
  });

  it('should reuse cached snapshot within one hour without live API calls', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    const { service, httpService, cacheService } = buildService();

    cacheService.get.mockImplementation(async (key: string) => {
      if (key === 'market-regime:last-success:v1') {
        return {
          btcDominance: 58.3,
          altcoinIndex: 41.2,
          feargreed: {
            index: 49,
            classification: 'Neutral',
            timestamp: 1708776000,
            date: '2024-02-24T12:00:00.000Z',
            timeUntilUpdate: 1800,
            diff: 1,
          },
          asOf: new Date(FIXED_NOW - 59 * 60 * 1000).toISOString(),
        };
      }
      return null;
    });

    const snapshot = await service.getSnapshot();

    expect(snapshot.source).toBe('live');
    expect(snapshot.btcDominance).toBe(58.3);
    expect(snapshot.altcoinIndex).toBe(41.2);
    expect(httpService.get).not.toHaveBeenCalled();
  });

  it('should fallback to cached feargreed in snapshot when live feargreed fetch fails', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    const { service, httpService, cacheService } = buildService();

    cacheService.get.mockImplementation(async (key: string) => {
      if (key === 'market-regime:feargreed:last-success:v1') {
        return {
          index: 45,
          classification: 'Fear',
          timestamp: 1708776000,
          date: '2024-02-24T12:00:00.000Z',
          timeUntilUpdate: 1200,
          diff: -2,
        };
      }
      return null;
    });

    httpService.get.mockImplementation((url: string) => {
      if (url.includes('global-metrics/crypto/overview/detail')) {
        return createCmcOverviewResponse(54.32, 60, '2026-02-24T12:00:00.000Z');
      }
      if (url.includes('alternative.me/fng')) {
        throw new Error('live feargreed failed');
      }
      throw new Error(`unexpected url: ${url}`);
    });

    const snapshot = await service.getSnapshot();

    expect(snapshot.source).toBe('live');
    expect(snapshot.feargreed).toEqual(
      expect.objectContaining({
        index: 45,
        classification: 'Fear',
        timestamp: 1708776000,
      }),
    );
  });

  it('should keep snapshot available with null feargreed when live and cached feargreed are unavailable', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    const { service, httpService, cacheService } = buildService();

    cacheService.get.mockResolvedValue(null);

    httpService.get.mockImplementation((url: string) => {
      if (url.includes('global-metrics/crypto/overview/detail')) {
        return createCmcOverviewResponse(54.32, 60, '2026-02-24T12:00:00.000Z');
      }
      if (url.includes('alternative.me/fng')) {
        throw new Error('live feargreed failed');
      }
      throw new Error(`unexpected url: ${url}`);
    });

    const snapshot = await service.getSnapshot();

    expect(snapshot.source).toBe('live');
    expect(snapshot.feargreed).toBeNull();
    expect(snapshot.btcDominance).toBe(54.32);
  });
});
