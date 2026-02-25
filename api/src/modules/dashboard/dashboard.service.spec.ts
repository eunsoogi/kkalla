import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const profitService = { getProfit: jest.fn() };
  const tradeService = { paginateTrades: jest.fn() };
  const holdingsService = { getHoldings: jest.fn() };
  const marketIntelligenceService = { getLatestWithPriceChange: jest.fn() };
  const marketRegimeService = { getSnapshot: jest.fn() };
  const newsService = { getNewsForDashboard: jest.fn() };

  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardService(
      profitService as any,
      tradeService as any,
      holdingsService as any,
      marketIntelligenceService as any,
      marketRegimeService as any,
      newsService as any,
    );
  });

  it('should aggregate all sections in one response', async () => {
    profitService.getProfit.mockResolvedValue({ email: 'test@example.com', profit: 100, todayProfit: 10 });
    tradeService.paginateTrades.mockResolvedValue({
      items: [{ id: 'trade-1' }],
      total: 1,
      page: 1,
      perPage: 50,
      totalPages: 1,
    });
    holdingsService.getHoldings.mockResolvedValue([{ symbol: 'BTC/KRW' }]);
    marketIntelligenceService.getLatestWithPriceChange.mockResolvedValue([{ id: 'mr-1' }]);
    marketRegimeService.getSnapshot.mockResolvedValue({
      btcDominance: 57.12,
      btcDominanceClassification: 'transition',
      altcoinIndex: 43.88,
      altcoinIndexClassification: 'neutral',
      feargreed: {
        index: 50,
        classification: 'Neutral',
        timestamp: 1708732800,
        date: '2024-02-24T00:00:00.000Z',
        timeUntilUpdate: 300,
        diff: 1,
      },
      asOf: new Date('2026-02-24T00:00:00.000Z'),
      source: 'live',
      isStale: false,
      staleAgeMinutes: 2,
    });
    newsService.getNewsForDashboard.mockResolvedValue([{ id: 'news-1' }]);

    const result = await service.getSummary({ id: 'user-1' } as any);

    expect(result.profit).toEqual({ email: 'test@example.com', profit: 100, todayProfit: 10 });
    expect(result.trades24h).toEqual([{ id: 'trade-1' }]);
    expect(result.holdings).toEqual([{ symbol: 'BTC/KRW' }]);
    expect(result.marketReports).toEqual([{ id: 'mr-1' }]);
    expect(result.marketRegime).toEqual({
      btcDominance: 57.12,
      btcDominanceClassification: 'transition',
      altcoinIndex: 43.88,
      altcoinIndexClassification: 'neutral',
      feargreed: {
        index: 50,
        classification: 'Neutral',
        timestamp: 1708732800,
        date: '2024-02-24T00:00:00.000Z',
        timeUntilUpdate: 300,
        diff: 1,
      },
      asOf: new Date('2026-02-24T00:00:00.000Z'),
      source: 'live',
      isStale: false,
      staleAgeMinutes: 2,
    });
    expect(result.news).toEqual([{ id: 'news-1' }]);
    expect(result.errors).toBeUndefined();

    expect(tradeService.paginateTrades).toHaveBeenCalledWith(
      { id: 'user-1' },
      expect.objectContaining({
        page: 1,
        perPage: 50,
        createdAt: expect.objectContaining({
          gte: expect.any(Date),
          lte: expect.any(Date),
        }),
      }),
    );
    expect(marketIntelligenceService.getLatestWithPriceChange).toHaveBeenCalledWith(10, { mode: 'mixed' });
    expect(marketRegimeService.getSnapshot).toHaveBeenCalledTimes(1);
    expect(newsService.getNewsForDashboard).toHaveBeenCalledWith(10);
  });

  it('should return per-section fallback values when some calls fail', async () => {
    profitService.getProfit.mockRejectedValue(new Error('profit failed'));
    tradeService.paginateTrades.mockResolvedValue({
      items: [{ id: 'trade-1' }],
      total: 1,
      page: 1,
      perPage: 50,
      totalPages: 1,
    });
    holdingsService.getHoldings.mockRejectedValue(new Error('holdings failed'));
    marketIntelligenceService.getLatestWithPriceChange.mockRejectedValue(new Error('market failed'));
    marketRegimeService.getSnapshot.mockRejectedValue(new Error('market regime failed'));
    newsService.getNewsForDashboard.mockResolvedValue([{ id: 'news-1' }]);

    const result = await service.getSummary({ id: 'user-1' } as any);

    expect(result.profit).toBeNull();
    expect(result.holdings).toEqual([]);
    expect(result.marketReports).toEqual([]);
    expect(result.marketRegime).toBeNull();
    expect(result.trades24h).toEqual([{ id: 'trade-1' }]);
    expect(result.errors).toEqual({
      profit: 'profit failed',
      holdings: 'holdings failed',
      marketReports: 'market failed',
      marketRegime: 'market regime failed',
    });
  });
});
