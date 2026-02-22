import { HoldingsService } from './holdings.service';

describe('HoldingsService', () => {
  const historyService = {
    fetchHistoryByUser: jest.fn(),
  };
  const upbitService = {
    getTickerAndDailyDataBatch: jest.fn(),
  };
  const categoryService = {
    findEnabledByUser: jest.fn(),
  };

  let service: HoldingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HoldingsService(historyService as any, upbitService as any, categoryService as any);
  });

  it('should use batch ticker+daily endpoint and map daily changes', async () => {
    historyService.fetchHistoryByUser.mockResolvedValue([
      { symbol: 'BTC/KRW', category: 'coin_major' },
      { symbol: 'ETH/KRW', category: 'coin_major' },
      { symbol: 'AAPL/USD', category: 'nasdaq' },
    ]);
    categoryService.findEnabledByUser.mockResolvedValue([{ category: 'coin_major' }, { category: 'nasdaq' }]);
    upbitService.getTickerAndDailyDataBatch.mockResolvedValue(
      new Map([
        [
          'BTC/KRW',
          {
            ticker: { last: 110 },
            candles1d: [
              [Date.now() - 86400000, 0, 0, 0, 100],
              [Date.now(), 0, 0, 0, 105],
            ],
          },
        ],
        [
          'ETH/KRW',
          {
            ticker: { last: 220 },
            candles1d: [
              [Date.now() - 86400000, 0, 0, 0, 200],
              [Date.now(), 0, 0, 0, 210],
            ],
          },
        ],
      ]),
    );

    const result = await service.getHoldings({ id: 'user-1' } as any);

    expect(upbitService.getTickerAndDailyDataBatch).toHaveBeenCalledWith(['BTC/KRW', 'ETH/KRW']);
    expect(result).toEqual([
      {
        symbol: 'BTC/KRW',
        category: 'coin_major',
        currentPrice: 110,
        dailyChangePct: 10,
        dailyChangeAbs: 10,
      },
      {
        symbol: 'ETH/KRW',
        category: 'coin_major',
        currentPrice: 220,
        dailyChangePct: 10,
        dailyChangeAbs: 20,
      },
      {
        symbol: 'AAPL/USD',
        category: 'nasdaq',
      },
    ]);
  });
});
