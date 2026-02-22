import { MarketRecommendation } from './entities/market-recommendation.entity';
import { MarketResearchService } from './market-research.service';

describe('MarketResearchService', () => {
  const upbitService = {
    getTickerAndDailyDataBatch: jest.fn(),
    getTickerAndDailyData: jest.fn(),
    getMinuteCandleAt: jest.fn(),
  };
  const reportValidationService = {
    getMarketValidationBadgeMap: jest.fn().mockResolvedValue(new Map()),
  };

  let service: MarketResearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(MarketRecommendation, 'createQueryBuilder').mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    } as any);
    service = new MarketResearchService(
      { t: jest.fn((key: string) => key) } as any,
      {} as any,
      {} as any,
      upbitService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      reportValidationService as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should cap minute-candle lookups to 3 in mixed mode', async () => {
    const now = Date.now();
    const recommendations = Array.from({ length: 5 }).map((_, index) => ({
      id: `id-${index}`,
      seq: index + 1,
      symbol: `SYM${index}/KRW`,
      weight: 0.2,
      reason: `reason-${index}`,
      confidence: 0.9 - index * 0.1,
      batchId: 'batch-1',
      createdAt: new Date(now - index * 60_000),
      updatedAt: new Date(now - index * 60_000),
    }));
    jest.spyOn(MarketRecommendation, 'getLatestRecommends').mockResolvedValue(recommendations as any);

    upbitService.getTickerAndDailyDataBatch.mockResolvedValue(
      new Map(
        recommendations.map((item) => [
          item.symbol,
          {
            ticker: { last: 110 },
            candles1d: [[new Date(item.createdAt).getTime(), 0, 0, 0, 100]],
          },
        ]),
      ),
    );
    upbitService.getMinuteCandleAt.mockResolvedValue(100);

    const result = await service.getLatestWithPriceChange(10, { mode: 'mixed' });

    expect(upbitService.getMinuteCandleAt).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(5);
    expect(result.every((item) => item.currentPrice === 110)).toBe(true);
    expect(result.every((item) => item.recommendationPrice === 100)).toBe(true);
  });

  it('should fallback to daily close when minute candle is unavailable', async () => {
    const createdAt = new Date(Date.now() - 60 * 60 * 1000);
    const recommendation = [
      {
        id: 'id-1',
        seq: 1,
        symbol: 'BTC/KRW',
        weight: 0.3,
        reason: 'reason',
        confidence: 0.8,
        batchId: 'batch-1',
        createdAt,
        updatedAt: createdAt,
      },
    ];
    jest.spyOn(MarketRecommendation, 'getLatestRecommends').mockResolvedValue(recommendation as any);

    upbitService.getTickerAndDailyDataBatch.mockResolvedValue(
      new Map([
        [
          'BTC/KRW',
          {
            ticker: { last: 120 },
            candles1d: [[createdAt.getTime(), 0, 0, 0, 90]],
          },
        ],
      ]),
    );
    upbitService.getMinuteCandleAt.mockResolvedValue(undefined);

    const result = await service.getLatestWithPriceChange(1, { mode: 'mixed' });

    expect(upbitService.getMinuteCandleAt).toHaveBeenCalledTimes(1);
    expect(result[0].recommendationPrice).toBe(90);
    expect(result[0].currentPrice).toBe(120);
    expect(result[0].priceChangePct).toBeCloseTo(33.33, 2);
  });

  it('should use stored recommendation price without minute lookup', async () => {
    const createdAt = new Date(Date.now() - 60 * 60 * 1000);
    const recommendation = [
      {
        id: 'id-1',
        seq: 1,
        symbol: 'BTC/KRW',
        weight: 0.3,
        reason: 'reason',
        confidence: 0.8,
        batchId: 'batch-1',
        createdAt,
        updatedAt: createdAt,
        recommendationPrice: 98,
      },
    ];
    jest.spyOn(MarketRecommendation, 'getLatestRecommends').mockResolvedValue(recommendation as any);

    upbitService.getTickerAndDailyDataBatch.mockResolvedValue(
      new Map([
        [
          'BTC/KRW',
          {
            ticker: { last: 120 },
            candles1d: [[createdAt.getTime(), 0, 0, 0, 90]],
          },
        ],
      ]),
    );

    const result = await service.getLatestWithPriceChange(1, { mode: 'mixed' });

    expect(upbitService.getMinuteCandleAt).not.toHaveBeenCalled();
    expect(result[0].recommendationPrice).toBe(98);
    expect(result[0].priceChangePct).toBeCloseTo(22.45, 2);
  });

  it('should snapshot recommendation price when saving a recommendation', async () => {
    const createdAt = new Date('2026-02-22T10:10:00.000Z');
    upbitService.getMinuteCandleAt.mockResolvedValue(101);
    const saveSpy = jest.spyOn(MarketRecommendation.prototype, 'save').mockImplementation(async function () {
      return this;
    });

    const saved = await service.saveMarketRecommendation(
      {
        id: 'id-1',
        batchId: 'batch-1',
        symbol: 'BTC/KRW',
        weight: 0.5,
        reason: 'reason',
        confidence: 0.9,
      } as any,
      {
        recommendationTime: createdAt,
      },
    );

    expect(upbitService.getMinuteCandleAt).toHaveBeenCalledWith('BTC/KRW', createdAt);
    expect(saved.recommendationPrice).toBe(101);
    expect(saveSpy).toHaveBeenCalled();
  });
});
