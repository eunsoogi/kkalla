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
        getBalances: jest.fn(),
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
        intensity: 0.8,
        hasStock: false,
        weight: 0.1,
        confidence: 0.8,
        modelTargetWeight: 0.15,
        buyScore: 0.75,
        sellScore: 0.2,
        action: 'buy',
      },
      {
        id: '2',
        batchId: 'batch-1',
        symbol: 'XRP/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.01,
        hasStock: false,
        weight: 0.1,
        confidence: 0.8,
        modelTargetWeight: 0,
        buyScore: 0.2,
        sellScore: 0.65,
        action: 'sell',
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

  it('should calculate model signals in 0~1 range and apply regime multiplier to target weight', () => {
    const signals = (service as any).calculateModelSignals(0.65, Category.COIN_MINOR, null);

    expect(signals.buyScore).toBeGreaterThanOrEqual(0);
    expect(signals.buyScore).toBeLessThanOrEqual(1);
    expect(signals.sellScore).toBeGreaterThanOrEqual(0);
    expect(signals.sellScore).toBeLessThanOrEqual(1);
    expect(signals.modelTargetWeight).toBeGreaterThanOrEqual(0);
    expect(signals.modelTargetWeight).toBeLessThanOrEqual(1);

    const targetWeight = (service as any).calculateTargetWeight(
      {
        symbol: 'SUI/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.65,
        hasStock: true,
        modelTargetWeight: signals.modelTargetWeight,
      },
      0.95,
    );

    expect(targetWeight).toBeCloseTo(signals.modelTargetWeight * 0.95, 10);
  });

  it('should not apply category exposure scaling to model target weight', () => {
    const majorSignals = (service as any).calculateModelSignals(0.65, Category.COIN_MAJOR, null);
    const minorSignals = (service as any).calculateModelSignals(0.65, Category.COIN_MINOR, null);

    expect(majorSignals.buyScore).toBeCloseTo(minorSignals.buyScore, 10);
    expect(majorSignals.modelTargetWeight).toBeCloseTo(minorSignals.modelTargetWeight, 10);
  });

  it('should apply top-k scaling when creating included trade requests', () => {
    const balances: any = { info: [] };
    const inferences = [
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.9,
        hasStock: false,
        modelTargetWeight: 0.5,
      },
    ];
    const currentWeights = new Map<string, number>();

    const requests = (service as any).generateIncludedTradeRequests(
      balances,
      inferences,
      5,
      1,
      currentWeights,
      1_000_000,
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].diff).toBeCloseTo(0.1, 10);
  });

  it('should not create a bullish feature bias when market features are missing', () => {
    const weakSignals = (service as any).calculateModelSignals(0.05, Category.COIN_MINOR, null);
    const neutralSignals = (service as any).calculateModelSignals(0, Category.COIN_MINOR, null);

    expect(weakSignals.buyScore).toBeLessThan(0.1);
    expect(weakSignals.modelTargetWeight).toBeLessThan(0.1);
    expect(neutralSignals.buyScore).toBe(0);
  });

  it('should keep weak positive intensity as buy and treat negative intensity as sell', () => {
    const weakBullishSignals = (service as any).calculateModelSignals(0.1, Category.COIN_MINOR, null);
    const bearishSignals = (service as any).calculateModelSignals(-0.1, Category.COIN_MINOR, null);

    expect(weakBullishSignals.sellScore).toBeLessThan(0.6);
    expect(weakBullishSignals.modelTargetWeight).toBeGreaterThan(0);
    expect(weakBullishSignals.action).toBe('buy');

    expect(bearishSignals.modelTargetWeight).toBe(0);
    expect(bearishSignals.action).toBe('sell');
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
        intensity: 0,
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

  it('should skip inference notify when no authorized recommendations are available', async () => {
    const notifyService = (service as any).notifyService;
    const upbitService = (service as any).upbitService;

    jest.spyOn(service as any, 'filterUserAuthorizedBalanceRecommendations').mockResolvedValue([]);

    const result = await service.executeRebalanceForUser({ id: 'user-1' } as any, [
      {
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
      } as any,
    ]);

    expect(result).toEqual([]);
    expect(notifyService.notify).not.toHaveBeenCalled();
    expect(upbitService.getBalances).not.toHaveBeenCalled();
    expect(upbitService.clearClients).toHaveBeenCalledTimes(1);
    expect(notifyService.clearClients).toHaveBeenCalledTimes(1);
  });

  it('should skip profit notify when no trades are executed in SQS message handling', async () => {
    const profitService = (service as any).profitService;
    const notifyService = (service as any).notifyService;

    jest.spyOn(service, 'executeRebalanceForUser').mockResolvedValue([]);
    const sqsSendMock = jest.spyOn((service as any).sqs, 'send').mockResolvedValue({} as any);

    await (service as any).handleMessage({
      MessageId: 'message-1',
      ReceiptHandle: 'receipt-1',
      Body: JSON.stringify({
        user: { id: 'user-1' },
        inferences: [],
        buyAvailable: true,
      }),
    });

    expect(profitService.getProfit).not.toHaveBeenCalled();
    expect(notifyService.notify).not.toHaveBeenCalled();
    expect(sqsSendMock).toHaveBeenCalledTimes(1);
    expect((sqsSendMock.mock.calls[0][0] as any).input).toMatchObject({
      QueueUrl: process.env.AWS_SQS_QUEUE_URL_REBALANCE,
      ReceiptHandle: 'receipt-1',
    });
  });
});
