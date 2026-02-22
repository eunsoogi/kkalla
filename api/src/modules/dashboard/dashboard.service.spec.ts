import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const profitService = { getProfit: jest.fn() };
  const tradeService = { paginateTrades: jest.fn() };
  const holdingsService = { getHoldings: jest.fn() };
  const marketResearchService = { getLatestWithPriceChange: jest.fn() };
  const newsService = { getNewsForDashboard: jest.fn() };
  const feargreedService = {
    getFeargreed: jest.fn(),
    getFeargreedHistory: jest.fn(),
  };

  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardService(
      profitService as any,
      tradeService as any,
      holdingsService as any,
      marketResearchService as any,
      newsService as any,
      feargreedService as any,
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
    marketResearchService.getLatestWithPriceChange.mockResolvedValue([{ id: 'mr-1' }]);
    newsService.getNewsForDashboard.mockResolvedValue([{ id: 'news-1' }]);
    feargreedService.getFeargreed.mockResolvedValue({ value: 50 });
    feargreedService.getFeargreedHistory.mockResolvedValue({ data: [{ value: 49 }] });

    const result = await service.getSummary({ id: 'user-1' } as any);

    expect(result.profit).toEqual({ email: 'test@example.com', profit: 100, todayProfit: 10 });
    expect(result.trades24h).toEqual([{ id: 'trade-1' }]);
    expect(result.holdings).toEqual([{ symbol: 'BTC/KRW' }]);
    expect(result.marketReports).toEqual([{ id: 'mr-1' }]);
    expect(result.news).toEqual([{ id: 'news-1' }]);
    expect(result.feargreed).toEqual({ value: 50 });
    expect(result.feargreedHistory).toEqual({ data: [{ value: 49 }] });
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
    expect(marketResearchService.getLatestWithPriceChange).toHaveBeenCalledWith(10, { mode: 'mixed' });
    expect(newsService.getNewsForDashboard).toHaveBeenCalledWith(10);
    expect(feargreedService.getFeargreedHistory).toHaveBeenCalledWith(7);
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
    marketResearchService.getLatestWithPriceChange.mockRejectedValue(new Error('market failed'));
    newsService.getNewsForDashboard.mockResolvedValue([{ id: 'news-1' }]);
    feargreedService.getFeargreed.mockResolvedValue({ value: 50 });
    feargreedService.getFeargreedHistory.mockRejectedValue(new Error('fear history failed'));

    const result = await service.getSummary({ id: 'user-1' } as any);

    expect(result.profit).toBeNull();
    expect(result.holdings).toEqual([]);
    expect(result.marketReports).toEqual([]);
    expect(result.feargreedHistory).toEqual({ data: [] });
    expect(result.trades24h).toEqual([{ id: 'trade-1' }]);
    expect(result.errors).toEqual({
      profit: 'profit failed',
      holdings: 'holdings failed',
      marketReports: 'market failed',
      feargreedHistory: 'fear history failed',
    });
  });
});
