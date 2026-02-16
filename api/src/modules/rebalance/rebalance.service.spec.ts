import { Category } from '../category/category.enum';
import { MarketRecommendation } from '../market-research/entities/market-recommendation.entity';
import { MARKET_RECOMMENDATION_STATE_MAX_AGE_MS } from '../market-research/market-research.interface';
import { RebalanceService } from './rebalance.service';

describe('RebalanceService', () => {
  let service: RebalanceService;
  let cacheService: {
    get: jest.Mock;
  };

  const originalQueueUrl = process.env.AWS_SQS_QUEUE_URL_REBALANCE;

  beforeAll(() => {
    process.env.AWS_SQS_QUEUE_URL_REBALANCE = 'https://example.com/test-rebalance-queue';
  });

  afterAll(() => {
    if (originalQueueUrl == null) {
      delete process.env.AWS_SQS_QUEUE_URL_REBALANCE;
      return;
    }

    process.env.AWS_SQS_QUEUE_URL_REBALANCE = originalQueueUrl;
  });

  beforeEach(() => {
    cacheService = {
      get: jest.fn(),
    };

    service = new RebalanceService(
      {
        t: jest.fn((key: string) => key),
      } as any,
      {
        findAll: jest.fn().mockResolvedValue([]),
      } as any,
      {
        fetchHistory: jest.fn().mockResolvedValue([]),
        saveHistory: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        getPrice: jest.fn(),
        isSymbolExist: jest.fn().mockResolvedValue(true),
        clearClients: jest.fn(),
      } as any,
      cacheService as any,
      {
        getUsers: jest.fn().mockResolvedValue([]),
      } as any,
      {
        findEnabledByUser: jest.fn().mockResolvedValue([]),
        checkCategoryPermission: jest.fn().mockReturnValue(true),
      } as any,
      {
        notify: jest.fn().mockResolvedValue(undefined),
        clearClients: jest.fn(),
      } as any,
      {
        getProfit: jest.fn().mockResolvedValue({ profit: 0 }),
      } as any,
      {
        getCompactNews: jest.fn().mockResolvedValue([]),
      } as any,
      {
        getCompactFeargreed: jest.fn().mockResolvedValue(null),
      } as any,
      {
        createResponse: jest.fn(),
        getResponseOutputText: jest.fn(),
        addMessage: jest.fn(),
        addMessagePair: jest.fn(),
      } as any,
      {
        MARKET_DATA_LEGEND: 'legend',
        extractMarketFeatures: jest.fn(),
        formatMarketData: jest.fn(),
      } as any,
      {
        retryWithFallback: jest.fn((fn: () => Promise<unknown>) => fn()),
      } as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should fallback to latest recommendations when recommendation cache state is stale', async () => {
    cacheService.get.mockResolvedValue({
      batchId: 'stale-batch',
      hasRecommendations: true,
      updatedAt: Date.now() - MARKET_RECOMMENDATION_STATE_MAX_AGE_MS - 1,
    });

    const latestRecommendations = [
      {
        symbol: 'ETH/KRW',
        batchId: 'latest-batch',
        weight: 0.2,
        confidence: 0.8,
        createdAt: new Date(),
      },
      {
        symbol: 'SOL/KRW',
        batchId: 'latest-batch',
        weight: 0.25,
        confidence: 0.9,
        createdAt: new Date(),
      },
      {
        symbol: 'DOGE/KRW',
        batchId: 'latest-batch',
        weight: 0.03,
        confidence: 0.9,
        createdAt: new Date(),
      },
    ] as MarketRecommendation[];

    const latestSpy = jest.spyOn(MarketRecommendation, 'getLatestRecommends').mockResolvedValue(latestRecommendations);

    const items = await (service as any).fetchRecommendItems();

    expect(latestSpy).toHaveBeenCalledTimes(1);
    expect(items).toEqual([
      {
        symbol: 'SOL/KRW',
        category: Category.COIN_MINOR,
        hasStock: false,
        weight: 0.25,
        confidence: 0.9,
      },
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MINOR,
        hasStock: false,
        weight: 0.2,
        confidence: 0.8,
      },
    ]);
  });

  it('should return empty recommendations when latest state says no recommendations and no newer batch exists', async () => {
    const updatedAt = Date.now();
    cacheService.get.mockResolvedValue({
      batchId: 'batch-empty',
      hasRecommendations: false,
      updatedAt,
    });

    const latestSpy = jest.spyOn(MarketRecommendation, 'getLatestRecommends').mockResolvedValue([
      {
        symbol: 'ETH/KRW',
        batchId: 'batch-empty',
        weight: 0.2,
        confidence: 0.8,
        createdAt: new Date(updatedAt - 60_000),
      },
    ] as MarketRecommendation[]);

    const findSpy = jest.spyOn(MarketRecommendation, 'find');

    const items = await (service as any).fetchRecommendItems();

    expect(latestSpy).toHaveBeenCalledTimes(1);
    expect(findSpy).not.toHaveBeenCalled();
    expect(items).toEqual([]);
  });

  it('should fallback to latest batch when cached batch differs from latest recommendations', async () => {
    const updatedAt = Date.now();
    cacheService.get.mockResolvedValue({
      batchId: 'batch-a',
      hasRecommendations: true,
      updatedAt,
    });

    const findSpy = jest.spyOn(MarketRecommendation, 'find').mockResolvedValue([
      {
        symbol: 'OLD/KRW',
        batchId: 'batch-a',
        weight: 0.3,
        confidence: 0.9,
        createdAt: new Date(updatedAt - 10_000),
      },
    ] as MarketRecommendation[]);

    const latestSpy = jest.spyOn(MarketRecommendation, 'getLatestRecommends').mockResolvedValue([
      {
        symbol: 'NEW/KRW',
        batchId: 'batch-b',
        weight: 0.15,
        confidence: 0.7,
        createdAt: new Date(updatedAt - 5_000),
      },
    ] as MarketRecommendation[]);

    const items = await (service as any).fetchRecommendItems();

    expect(findSpy).toHaveBeenCalledWith({ where: { batchId: 'batch-a' } });
    expect(latestSpy).toHaveBeenCalledTimes(1);
    expect(items).toEqual([
      {
        symbol: 'NEW/KRW',
        category: Category.COIN_MINOR,
        hasStock: false,
        weight: 0.15,
        confidence: 0.7,
      },
    ]);
  });

  it('should build included trade requests from target-weight delta and skip low-signal symbols', () => {
    const balances: any = { info: [] };
    const inferences: any[] = [
      {
        id: '1',
        batchId: 'batch-1',
        symbol: 'ETH/KRW',
        category: Category.COIN_MINOR,
        rate: 0.8,
        hasStock: false,
        weight: 0.1,
        confidence: 0.8,
      },
      {
        id: '2',
        batchId: 'batch-1',
        symbol: 'XRP/KRW',
        category: Category.COIN_MINOR,
        rate: 0.01,
        hasStock: false,
        weight: 0.1,
        confidence: 0.8,
      },
    ];

    const currentWeights = new Map<string, number>([['ETH/KRW', 0.01]]);
    const marketPrice = 1_000_000;

    const requests = (service as any).generateIncludedTradeRequests(
      balances,
      inferences,
      5,
      1,
      currentWeights,
      marketPrice,
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].symbol).toBe('ETH/KRW');
    expect(requests[0].marketPrice).toBe(marketPrice);
    expect(requests[0].diff).toBeGreaterThan(0);
    expect(requests[0].inference.symbol).toBe('ETH/KRW');
  });

  it('should keep target weight close to linear base and clamp correction range', () => {
    const targetWeight = (service as any).calculateTargetWeight(
      {
        symbol: 'SUI/KRW',
        category: Category.COIN_MINOR,
        rate: 0.65,
        hasStock: true,
        weight: 0.15,
        confidence: 0.9,
      },
      0.95,
    );

    const baseWeight = 0.65 * 0.2; // 13%
    expect(targetWeight).toBeGreaterThanOrEqual(baseWeight * 0.85 - 1e-12);
    expect(targetWeight).toBeLessThanOrEqual(baseWeight * 1.05 + 1e-12);
  });

  it('should filter out non-orderable symbols from fetched recommendations', async () => {
    cacheService.get.mockResolvedValue({
      batchId: 'stale-batch',
      hasRecommendations: true,
      updatedAt: Date.now() - MARKET_RECOMMENDATION_STATE_MAX_AGE_MS - 1,
    });

    jest.spyOn(MarketRecommendation, 'getLatestRecommends').mockResolvedValue([
      {
        symbol: 'SUI/KRW',
        batchId: 'latest-batch',
        weight: 0.2,
        confidence: 0.8,
        createdAt: new Date(),
      },
      {
        symbol: 'XCODE/KRW',
        batchId: 'latest-batch',
        weight: 0.2,
        confidence: 0.8,
        createdAt: new Date(),
      },
      {
        symbol: 'FLR/USDT',
        batchId: 'latest-batch',
        weight: 0.2,
        confidence: 0.8,
        createdAt: new Date(),
      },
    ] as MarketRecommendation[]);

    const upbitService = (service as any).upbitService;
    upbitService.isSymbolExist
      .mockResolvedValueOnce(true) // SUI/KRW
      .mockResolvedValueOnce(false); // XCODE/KRW

    const items = await (service as any).fetchRecommendItems();

    expect(items).toEqual([
      {
        symbol: 'SUI/KRW',
        category: Category.COIN_MINOR,
        hasStock: false,
        weight: 0.2,
        confidence: 0.8,
      },
    ]);
  });

  it('should keep unchecked symbols when orderable validation partially fails', async () => {
    cacheService.get.mockResolvedValue({
      batchId: 'stale-batch',
      hasRecommendations: true,
      updatedAt: Date.now() - MARKET_RECOMMENDATION_STATE_MAX_AGE_MS - 1,
    });

    jest.spyOn(MarketRecommendation, 'getLatestRecommends').mockResolvedValue([
      {
        symbol: 'SUI/KRW',
        batchId: 'latest-batch',
        weight: 0.2,
        confidence: 0.8,
        createdAt: new Date(),
      },
      {
        symbol: 'XCODE/KRW',
        batchId: 'latest-batch',
        weight: 0.2,
        confidence: 0.8,
        createdAt: new Date(),
      },
    ] as MarketRecommendation[]);

    const upbitService = (service as any).upbitService;
    upbitService.isSymbolExist
      .mockResolvedValueOnce(true) // SUI/KRW
      .mockRejectedValueOnce(new Error('temporary failure')); // XCODE/KRW

    const items = await (service as any).fetchRecommendItems();

    expect(items.map((item: any) => item.symbol)).toEqual(['SUI/KRW', 'XCODE/KRW']);
  });

  it('should create non-balance sell requests only for orderable symbols above minimum trade amount', () => {
    const balances: any = {
      info: [
        {
          currency: 'FLR',
          unit_currency: 'KRW',
          balance: '100',
          avg_buy_price: '10',
        },
        {
          currency: 'TRX',
          unit_currency: 'KRW',
          balance: '100',
          avg_buy_price: '100',
        },
      ],
    };

    const inferences: any[] = [];
    const orderableSymbols = new Set<string>(['FLR/KRW', 'TRX/KRW']);
    const tradableMarketValueMap = new Map<string, number>([
      ['FLR/KRW', 1_000], // 최소 주문 금액 미달
      ['TRX/KRW', 10_000],
    ]);

    const requests = (service as any).generateNonBalanceRecommendationTradeRequests(
      balances,
      inferences,
      1_000_000,
      orderableSymbols,
      tradableMarketValueMap,
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].symbol).toBe('TRX/KRW');
    expect(requests[0].diff).toBe(-1);
  });

  it('should not skip excluded liquidation when tradable market value is unknown', () => {
    const balances: any = { info: [] };
    const inferences = [
      {
        symbol: 'AAA/KRW',
        category: Category.COIN_MINOR,
        rate: 0,
        hasStock: true,
      },
    ];

    const requests = (service as any).generateExcludedTradeRequests(
      balances,
      inferences,
      1,
      1_000_000,
      new Set<string>(['AAA/KRW']),
      new Map<string, number>(),
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].symbol).toBe('AAA/KRW');
    expect(requests[0].diff).toBe(-1);
  });
});
